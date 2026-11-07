import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
      memberships: {
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Account not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
      workspaces: user.memberships.map((membership) => ({
        ...membership.organization,
        role: membership.role,
      })),
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}