import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function getClientIp(request: Request): string {
  // In production, configure the trusted reverse proxy to set x-real-ip.
  const realIp = request.headers.get("x-real-ip")?.trim();

  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  const addresses = forwarded
    ? forwarded.split(",").map((value) => value.trim()).filter(Boolean)
    : [];

  return addresses.length > 0
    ? addresses[addresses.length - 1]
    : "local-development";
}

export function rateLimitKey(scope: string, identifier: string): string {
  return createHash("sha256")
    .update(`${scope}:${identifier}`)
    .digest("hex");
}

export async function consumeRateLimit(
  key: string,
  options: {
    limit: number;
    windowSeconds: number;
    blockSeconds: number;
  }
) {
  const now = new Date();
  const cutoff = new Date(
    now.getTime() - options.windowSeconds * 1000
  );
  const nextBlock = new Date(
    now.getTime() + options.blockSeconds * 1000
  );

  const rows = await prisma.$queryRaw<
    Array<{ count: number; blockedUntil: Date | null }>
  >`
    INSERT INTO "AuthRateLimit"
      ("key", "count", "windowStartedAt", "blockedUntil", "createdAt", "updatedAt")
    VALUES
      (${key}, 1, ${now}, NULL, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= ${cutoff}
          THEN 1
        ELSE "AuthRateLimit"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= ${cutoff}
          THEN ${now}
        ELSE "AuthRateLimit"."windowStartedAt"
      END,
      "blockedUntil" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= ${cutoff}
          THEN NULL
        WHEN "AuthRateLimit"."blockedUntil" IS NOT NULL
          AND "AuthRateLimit"."blockedUntil" > ${now}
          THEN "AuthRateLimit"."blockedUntil"
        WHEN "AuthRateLimit"."count" + 1 >= ${options.limit}
          THEN ${nextBlock}
        ELSE NULL
      END,
      "updatedAt" = ${now}
    RETURNING "count", "blockedUntil"
  `;

  const row = rows[0];
  const blocked =
    Boolean(row?.blockedUntil) &&
    row.blockedUntil! > now;

  return {
    allowed: !blocked,
    count: row?.count ?? 0,
    retryAfterSeconds: blocked
      ? Math.max(
          1,
          Math.ceil(
            (row!.blockedUntil!.getTime() - now.getTime()) / 1000
          )
        )
      : 0,
  };
}

export async function clearRateLimit(key: string) {
  await prisma.authRateLimit.deleteMany({
    where: { key },
  });
}