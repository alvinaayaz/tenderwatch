import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_URL = "https://www.pc.gov.pk/web/tender";
const ALLOWED_HOST = "www.pc.gov.pk";
const ALLOWED_PATH = "/web/tender";

export async function POST(request: Request) {
  try {
    let body: { url?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Please provide a valid JSON request." },
        { status: 400 }
      );
    }

    if (typeof body?.url !== "string" || !body.url.trim()) {
      return NextResponse.json(
        { error: "A tender URL is required." },
        { status: 400 }
      );
    }

    let parsed: URL;

    try {
      parsed = new URL(body.url);
    } catch {
      return NextResponse.json(
        { error: "Please provide a valid URL." },
        { status: 400 }
      );
    }

    if (
      parsed.protocol !== "https:" ||
      parsed.hostname.toLowerCase() !== ALLOWED_HOST ||
      parsed.pathname !== ALLOWED_PATH ||
      parsed.port !== "" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      return NextResponse.json(
        {
          error:
            "This demo currently supports only the Ministry of Planning tender page: " +
            ALLOWED_URL,
        },
        { status: 400 }
      );
    }

    const response = await fetch(ALLOWED_URL, {
      headers: {
        "User-Agent": "TenderWatchMVP/1.0",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `The website returned HTTP ${response.status}. It may block automated checks.`,
        },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") || "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      return NextResponse.json(
        {
          error: "The page did not return readable HTML or text.",
        },
        { status: 415 }
      );
    }

    const html = (await response.text()).slice(0, 1000000);

    const text = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      return NextResponse.json(
        { error: "No readable page text was found." },
        { status: 422 }
      );
    }

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );

    const fingerprint = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const rawTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const title = rawTitle
      ? rawTitle.replace(/<[^>]+>/g, "").trim()
      : "Untitled page";

    return NextResponse.json({
      success: true,
      url: ALLOWED_URL,
      checkedAt: new Date().toISOString(),
      title,
      fingerprint,
      preview: text.slice(0, 350),
      note:
        "Page-text snapshot only. A difference indicates a possible change, not a verified tender amendment.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: message.toLowerCase().includes("timeout")
          ? "The website took too long to respond."
          : "The page could not be checked. It may block automated requests.",
      },
      { status: 502 }
    );
  }
}
