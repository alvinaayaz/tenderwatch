import { NextResponse } from "next/server";
import {
  checkTenderPage,
  TenderCheckError,
} from "@/lib/tender-check";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitKey,
} from "@/lib/security/rate-limit";
import { readJsonObject } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rate = await consumeRateLimit(
      rateLimitKey("public-tender-check", getClientIp(request)),
      {
        limit: 11,
        windowSeconds: 900,
        blockSeconds: 900,
      }
    );

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many demo checks. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rate.retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const parsedBody = await readJsonObject(request, 4096);

    if (!parsedBody.ok) {
      return NextResponse.json(
        { error: parsedBody.error },
        { status: parsedBody.status }
      );
    }

    const url = parsedBody.value.url;

    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { error: "A tender URL is required." },
        { status: 400 }
      );
    }

    const result = await checkTenderPage(url);

    return NextResponse.json(
      {
        success: result.success,
        url: result.url,
        checkedAt: result.checkedAt,
        title: result.title,
        fingerprint: result.fingerprint,
        preview: result.preview,
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

    console.error("Public tender check failed:", error);

    return NextResponse.json(
      { error: "The page could not be checked." },
      { status: 502 }
    );
  }
}