import { NextResponse } from "next/server";
import { getWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { workspaceId: string } }
) {
  const access = await getWorkspaceAccess(params.workspaceId);

  if (!access.ok) {
    return NextResponse.json(
      {
        error:
          access.status === 401
            ? "Authentication required."
            : "Workspace not found.",
      },
      {
        status: access.status,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  return NextResponse.json(
    {
      workspace: access.membership.organization,
      membership: {
        role: access.membership.role,
      },
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}