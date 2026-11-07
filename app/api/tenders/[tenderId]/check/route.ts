import { runTenderCheck } from "@/lib/monitoring/run-tender-check";
import { assertSameOrigin } from "@/lib/security/origin";
import { NextResponse } from "next/server";
import { MembershipRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorkspaceAccess, hasWorkspaceRole } from "@/lib/workspace-access";
import { TenderCheckError } from "@/lib/tender-check";

import {
  consumeRateLimit,
  rateLimitKey,
} from "@/lib/security/rate-limit";
import { readJsonObject } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { tenderId: string } | Promise<{ tenderId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const originRejection = assertSameOrigin(request);
  if (originRejection) return originRejection;
  try {
    const { tenderId } = await context.params;

    const parsedBody = await readJsonObject(request, 4096);

    if (!parsedBody.ok) {
      return NextResponse.json(
        { error: parsedBody.error },
        { status: parsedBody.status }
      );
    }

    const workspaceId =
      typeof parsedBody.value.workspaceId === "string"
        ? parsedBody.value.workspaceId
        : "";

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID is required." },
        { status: 400 }
      );
    }

    const access = await getWorkspaceAccess(workspaceId);

    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.status === 401
              ? "Authentication required."
              : "Workspace not found.",
        },
        { status: access.status }
      );
    }

    if (
      !hasWorkspaceRole(access.membership.role, [
        MembershipRole.OWNER,
        MembershipRole.ADMIN,
        MembershipRole.MEMBER,
      ])
    ) {
      return NextResponse.json(
        { error: "You do not have permission to check tenders." },
        { status: 403 }
      );
    }

    const tender = await prisma.tender.findFirst({
      where: {
        id: tenderId,
        organizationId: workspaceId,
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
      },
    });

    if (!tender) {
      return NextResponse.json(
        { error: "Tender not found in this workspace." },
        { status: 404 }
      );
    }

    const rate = await consumeRateLimit(
      rateLimitKey("tender-check", `${access.userId}:${tender.id}`),
      {
        limit: 11,
        windowSeconds: 900,
        blockSeconds: 900,
      }
    );

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many checks for this tender. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rate.retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        }
      );
    }

        const { result, persisted } = await runTenderCheck(tender);

    return NextResponse.json(
      {
        success: true,
        tender: {
          id: tender.id,
          title: tender.title,
        },
        check: {
          checkedAt: persisted.snapshot.checkedAt.toISOString(),
          fingerprint: persisted.snapshot.fingerprint,
          title: persisted.snapshot.pageTitle,
          preview: persisted.snapshot.preview,
          isBaseline: persisted.isBaseline,
          changeDetected: persisted.changeDetected,
          change: persisted.change
            ? {
                ...persisted.change,
                detectedAt: persisted.change.detectedAt.toISOString(),
              }
            : null,
        },
        note: result.note,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof TenderCheckError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          error:
            "Another check was being saved at the same time. Please retry.",
        },
        { status: 409 }
      );
    }

    console.error("Authenticated tender check failed:", error);

    return NextResponse.json(
      { error: "Could not complete or save the tender check." },
      { status: 500 }
    );
  }
}