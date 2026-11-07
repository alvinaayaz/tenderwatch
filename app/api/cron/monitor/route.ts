import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runTenderCheck } from "@/lib/monitoring/run-tender-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_JOB_LOCK = 6041106;
const MAX_JOBS_PER_RUN = 5;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Scheduled monitoring is not configured." },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);

    // Recover jobs abandoned by a crashed or terminated worker.
    // The 15-minute threshold is safely above the normal check timeout.
    const staleCutoff = new Date(now.getTime() - 15 * 60 * 1000);

    const recovered = await prisma.monitoringJob.updateMany({
      where: {
        status: "PROCESSING",
        startedAt: { lt: staleCutoff },
      },
      data: {
        status: "PENDING",
        startedAt: null,
        finishedAt: null,
        lastError: "Recovered after the previous worker stopped unexpectedly.",
      },
    });

    // Serialize daily enqueue operations so duplicate cron deliveries
    // cannot create duplicate daily jobs.
    const enqueued = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${DAILY_JOB_LOCK})::text`;

      const tenders = await tx.tender.findMany({
        select: { id: true },
      });

      if (tenders.length === 0) return 0;

      const tenderIds = tenders.map((tender) => tender.id);

      const existingJobs = await tx.monitoringJob.findMany({
        where: {
          tenderId: { in: tenderIds },
          OR: [
            { status: { in: ["PENDING", "PROCESSING"] } },
            {
              scheduledAt: { gte: dayStart },
              status: { in: ["COMPLETED", "FAILED"] },
            },
          ],
        },
        select: { tenderId: true },
      });

      const existingTenderIds = new Set(
        existingJobs.map((job) => job.tenderId)
      );

      const newJobs = tenders
        .filter((tender) => !existingTenderIds.has(tender.id))
        .map((tender) => ({
          tenderId: tender.id,
          scheduledAt: now,
          status: "PENDING" as const,
        }));

      if (newJobs.length === 0) return 0;

      const created = await tx.monitoringJob.createMany({
        data: newJobs,
      });

      return created.count;
    });

    const jobs = await prisma.monitoringJob.findMany({
      where: {
        status: "PENDING",
        scheduledAt: { lte: now },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: MAX_JOBS_PER_RUN,
      select: {
        id: true,
        tenderId: true,
      },
    });

    let completed = 0;
    let failed = 0;
    let skipped = 0;

    // Each job is claimed atomically. Duplicate invocations cannot
    // successfully claim the same PENDING job.
    await Promise.all(
      jobs.map(async (job) => {
        const claim = await prisma.monitoringJob.updateMany({
          where: {
            id: job.id,
            status: "PENDING",
          },
          data: {
            status: "PROCESSING",
            startedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });

        if (claim.count === 0) {
          skipped += 1;
          return;
        }

        try {
          const tender = await prisma.tender.findUnique({
            where: { id: job.tenderId },
            select: {
              id: true,
              title: true,
              sourceUrl: true,
            },
          });

          if (!tender) {
            throw new Error("Tender no longer exists.");
          }

          await runTenderCheck(tender);

          await prisma.monitoringJob.update({
            where: { id: job.id },
            data: {
              status: "COMPLETED",
              finishedAt: new Date(),
              lastError: null,
            },
          });

          completed += 1;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message.slice(0, 2000)
              : "Unknown scheduled monitoring error.";

          await prisma.monitoringJob.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              finishedAt: new Date(),
              lastError: message,
            },
          });

          failed += 1;
          console.error(`Scheduled tender check failed (${job.id}):`, message);
        }
      })
    );

    const remaining = await prisma.monitoringJob.count({
      where: {
        status: "PENDING",
        scheduledAt: { lte: now },
      },
    });

    return NextResponse.json(
      {
        success: true,
        enqueued,
        recovered: recovered.count,
        claimed: completed + failed,
        completed,
        failed,
        skipped,
        remaining,
        batchLimit: MAX_JOBS_PER_RUN,
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Scheduled monitoring worker failed:", error);

    return NextResponse.json(
      { error: "Scheduled monitoring could not complete." },
      { status: 500 }
    );
  }
}