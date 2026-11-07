import { assertSameOrigin } from "@/lib/security/origin";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitKey,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originRejection = assertSameOrigin(request);
  if (originRejection) return originRejection;
  try {
    const key = rateLimitKey("register", getClientIp(request));

    const rate = await consumeRateLimit(key, {
      limit: 5,
      windowSeconds: 3600,
      blockSeconds: 3600,
    });

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rate.retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const declaredLength = Number(
      request.headers.get("content-length") || "0"
    );

    if (declaredLength > 16384) {
      return NextResponse.json(
        { error: "Registration request is too large." },
        { status: 413 }
      );
    }

    const raw = await request.text();

    if (Buffer.byteLength(raw, "utf8") > 16384) {
      return NextResponse.json(
        { error: "Registration request is too large." },
        { status: 413 }
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Invalid registration request." },
        { status: 400 }
      );
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return NextResponse.json(
        { error: "Invalid registration request." },
        { status: 400 }
      );
    }

    const body = parsed as Record<string, unknown>;

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    const requestedWorkspace =
      typeof body.workspaceName === "string"
        ? body.workspaceName.trim()
        : "";

    const workspaceName =
      requestedWorkspace || `${name}'s Workspace`;

    if (
      name.length < 2 ||
      name.length > 80 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      workspaceName.length < 2 ||
      workspaceName.length > 100
    ) {
      return NextResponse.json(
        { error: "Please provide valid account and workspace details." },
        { status: 400 }
      );
    }

    const passwordBytes = Buffer.byteLength(password, "utf8");

    if (password.length < 12 || passwordBytes > 72) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 12 characters and no more than 72 UTF-8 bytes.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    const slugBase =
      workspaceName
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || "workspace";

    const slug = `${slugBase}-${randomUUID().slice(0, 8)}`;

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: workspaceName,
          slug,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "OWNER",
        },
      });

      return {
        userId: user.id,
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
      };
    });

    return NextResponse.json(
      {
        success: true,
        userId: created.userId,
        email,
        emailVerified: false,
        workspace: {
          id: created.organizationId,
          name: created.organizationName,
          slug: created.organizationSlug,
          role: "OWNER",
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Unable to create an account with those details." },
        { status: 409 }
      );
    }

    console.error("[TenderWatch] Registration failed.");

    return NextResponse.json(
      { error: "Account registration is temporarily unavailable." },
      { status: 500 }
    );
  }
}