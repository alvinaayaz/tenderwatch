import type { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getWorkspaceAccess(workspaceId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      ok: false as const,
      status: 401 as const,
    };
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: workspaceId,
      },
    },
    select: {
      userId: true,
      organizationId: true,
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!membership) {
    // Do not reveal whether an inaccessible workspace exists.
    return {
      ok: false as const,
      status: 404 as const,
    };
  }

  return {
    ok: true as const,
    userId: session.user.id,
    membership,
  };
}

export function hasWorkspaceRole(
  role: MembershipRole,
  allowedRoles: readonly MembershipRole[]
): boolean {
  return allowedRoles.includes(role);
}