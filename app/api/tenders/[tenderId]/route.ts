import { assertSameOrigin } from "@/lib/security/origin";
import { NextResponse } from "next/server";
import { MembershipRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorkspaceAccess, hasWorkspaceRole } from "@/lib/workspace-access";
import { readJsonObject } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_URL = "https://www.pc.gov.pk/web/tender";

type RouteContext = {
  params: { tenderId: string } | Promise<{ tenderId: string }>;
};

function canWrite(role: MembershipRole) {
  return hasWorkspaceRole(role, [
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.MEMBER,
  ]);
}

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

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return undefined;
  }

  return date;
}

async function getAuthorizedTender(
  tenderId: string,
  workspaceId: string,
  requireWrite = false
) {
  const access = await getWorkspaceAccess(workspaceId);

  if (!access.ok) {
    return {
      error: NextResponse.json(
        {
          error:
            access.status === 401
              ? "Authentication required."
              : "Workspace not found.",
        },
        { status: access.status }
      ),
    };
  }

  if (requireWrite && !canWrite(access.membership.role)) {
    return {
      error: NextResponse.json(
        { error: "You do not have permission to modify this tender." },
        { status: 403 }
      ),
    };
  }

  const tender = await prisma.tender.findFirst({
    where: {
      id: tenderId,
      organizationId: workspaceId,
    },
  });

  if (!tender) {
    return {
      error: NextResponse.json(
        { error: "Tender not found in this workspace." },
        { status: 404 }
      ),
    };
  }

  return { access, tender };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { tenderId } = await context.params;
    const workspaceId = new URL(request.url).searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID is required." },
        { status: 400 }
      );
    }

    const result = await getAuthorizedTender(tenderId, workspaceId);

    if ("error" in result) return result.error;

    return NextResponse.json(
      { tender: result.tender },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Tender retrieval failed:", error);
    return NextResponse.json(
      { error: "Could not retrieve tender." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const originRejection = assertSameOrigin(request);
  if (originRejection) return originRejection;
  try {
    const { tenderId } = await context.params;
    const parsedBody = await readJsonObject(request, 16384);

    if (!parsedBody.ok) {
      return NextResponse.json(
        { error: parsedBody.error },
        { status: parsedBody.status }
      );
    }

    const body = parsedBody.value;

    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : "";

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID is required." },
        { status: 400 }
      );
    }

    const result = await getAuthorizedTender(
      tenderId,
      workspaceId,
      true
    );

    if ("error" in result) return result.error;

    const data: Prisma.TenderUpdateInput = {};

    if (body.title !== undefined) {
      if (
        typeof body.title !== "string" ||
        body.title.trim().length < 3 ||
        body.title.trim().length > 250
      ) {
        return NextResponse.json(
          { error: "Tender title must be between 3 and 250 characters." },
          { status: 400 }
        );
      }

      data.title = body.title.trim();
    }

    if (body.organization !== undefined) {
      if (
        typeof body.organization !== "string" ||
        body.organization.trim().length > 250
      ) {
        return NextResponse.json(
          { error: "Invalid procuring organization." },
          { status: 400 }
        );
      }

      data.procuringOrganization =
        body.organization.trim() || null;
    }

    if (body.deadline !== undefined) {
      const deadline = validDeadline(body.deadline);

      if (deadline === undefined) {
        return NextResponse.json(
          { error: "Enter a valid submission deadline." },
          { status: 400 }
        );
      }

      data.deadline = deadline;
    }

    if (body.url !== undefined) {
      if (!validTenderUrl(body.url)) {
        return NextResponse.json(
          { error: `This demo currently supports only ${ALLOWED_URL}` },
          { status: 400 }
        );
      }

      data.sourceUrl = body.url;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid changes were provided." },
        { status: 400 }
      );
    }

    const tender = await prisma.tender.update({
      where: { id: result.tender.id },
      data,
      select: {
        id: true,
        title: true,
        procuringOrganization: true,
        deadline: true,
        sourceUrl: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ tender });
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

    console.error("Tender update failed:", error);

    return NextResponse.json(
      { error: "Could not update tender." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const originRejection = assertSameOrigin(request);
  if (originRejection) return originRejection;
  try {
    const { tenderId } = await context.params;
    const workspaceId = new URL(request.url).searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID is required." },
        { status: 400 }
      );
    }

    const result = await getAuthorizedTender(
      tenderId,
      workspaceId,
      true
    );

    if ("error" in result) return result.error;

    await prisma.tender.delete({
      where: { id: result.tender.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tender deletion failed:", error);

    return NextResponse.json(
      { error: "Could not delete tender." },
      { status: 500 }
    );
  }
}