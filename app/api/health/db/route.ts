import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      service: "tenderwatch",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[TenderWatch] Database health check failed:",
      error instanceof Error ? error.message : "Unknown database error"
    );

    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        service: "tenderwatch",
      },
      { status: 503 }
    );
  }
}