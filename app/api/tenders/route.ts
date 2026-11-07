import { assertSameOrigin } from "@/lib/security/origin";
import { NextResponse } from "next/server";
import { MembershipRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorkspaceAccess, hasWorkspaceRole } from "@/lib/workspace-access";
import { readJsonObject } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_URL = "https://www.pc.gov.pk/web/tender";

function validTenderUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.href === ALLOWED_URL &&
      url.protocol === "https:" &&
      url.hostname === "www.pc.gov.pk" &&
      url.pathname === "/web/tender" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function validDeadline(value: unknown): Date | null | undefined {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return undefined;
  }
  return date;
}

function canWrite(role: MembershipRole) {
  return hasWorkspaceRole(role, [
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.MEMBER,
  ]);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace ID is required." }, { status: 400 });
    }

    const access = await getWorkspaceAccess(workspaceId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 401 ? "Authentication required." : "Workspace not found." },
        { status: access.status }
      );
    }

    const tenders = await prisma.tender.findMany({
      where: { organizationId: workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        snapshots: {
          orderBy: { checkedAt: "desc" },
          take: 20,
          select: {
            id: true,
            fingerprint: true,
            pageTitle: true,
            preview: true,
            checkedAt: true,
          },
        },
        changes: {
          orderBy: { detectedAt: "desc" },
          take: 20,
          select: {
            id: true,
            currentSnapshotId: true,
            changeType: true,
            summary: true,
            evidence: true,
            detectedAt: true,
          },
        },
      },
    });

    const result = tenders.map((tender) => {
      const latestSnapshot = tender.snapshots[0] ?? null;
      const latestChange = tender.changes[0] ?? null;
      const changeBySnapshot = new Map(
        tender.changes.map((change) => [change.currentSnapshotId, change])
      );

      return {
        id: tender.id,
        title: tender.title,
        organization: tender.procuringOrganization ?? "",
        deadline: tender.deadline?.toISOString().slice(0, 10) ?? "",
        url: tender.sourceUrl,
        status:
          latestChange &&
          latestSnapshot &&
          latestChange.detectedAt.getTime() >= latestSnapshot.checkedAt.getTime()
            ? "Changed"
            : "Monitoring",
        fingerprint: latestSnapshot?.fingerprint ?? null,
        lastChecked: latestSnapshot?.checkedAt.toISOString() ?? null,
        preview: latestSnapshot?.preview ?? null,
        pageTitle: latestSnapshot?.pageTitle ?? null,
        latestChange: latestChange
          ? {
              id: latestChange.id,
              changeType: latestChange.changeType,
              summary: latestChange.summary,
              evidence: latestChange.evidence,
              detectedAt: latestChange.detectedAt.toISOString(),
            }
          : null,
        changeHistory: [...tender.snapshots].reverse().map((snapshot) => {
          const change = changeBySnapshot.get(snapshot.id);
          return {
            checkedAt: snapshot.checkedAt.toISOString(),
            status: change ? "Possible page-text change" : "Check completed",
          };
        }),
        createdAt: tender.createdAt.toISOString(),
        updatedAt: tender.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(
      { tenders: result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Tender list failed:", error);
    return NextResponse.json({ error: "Could not load tenders." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const originRejection = assertSameOrigin(request);
  if (originRejection) return originRejection;
  try {
    const parsedBody = await readJsonObject(request, 16384);

    if (!parsedBody.ok) {
      return NextResponse.json(
        { error: parsedBody.error },
        { status: parsedBody.status }
      );
    }

    const body = parsedBody.value;

    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const organization =
      typeof body.organization === "string" ? body.organization.trim() : "";
    const deadline = validDeadline(body.deadline);
    const sourceUrl = body.url;

    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace ID is required." }, { status: 400 });
    }
    if (title.length < 3 || title.length > 250) {
      return NextResponse.json(
        { error: "Tender title must be between 3 and 250 characters." },
        { status: 400 }
      );
    }
    if (organization.length > 250) {
      return NextResponse.json(
        { error: "Organization name is too long." },
        { status: 400 }
      );
    }
    if (deadline === undefined) {
      return NextResponse.json({ error: "Enter a valid submission deadline." }, { status: 400 });
    }
    if (!validTenderUrl(sourceUrl)) {
      return NextResponse.json(
        { error: `This demo currently supports only ${ALLOWED_URL}` },
        { status: 400 }
      );
    }

    const access = await getWorkspaceAccess(workspaceId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 401 ? "Authentication required." : "Workspace not found." },
        { status: access.status }
      );
    }
    if (!canWrite(access.membership.role)) {
      return NextResponse.json({ error: "You do not have permission to add tenders." }, { status: 403 });
    }

    const tender = await prisma.tender.create({
      data: {
        organizationId: workspaceId,
        createdById: access.userId,
        title,
        procuringOrganization: organization || null,
        deadline,
        sourceUrl,
      },
      select: {
        id: true,
        title: true,
        procuringOrganization: true,
        deadline: true,
        sourceUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ tender }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This tender URL is already in your workspace." },
        { status: 409 }
      );
    }
    console.error("Tender creation failed:", error);
    return NextResponse.json({ error: "Could not create tender." }, { status: 500 });
  }
}
