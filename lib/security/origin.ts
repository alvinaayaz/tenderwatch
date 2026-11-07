import { NextResponse } from "next/server";

export function assertSameOrigin(request: Request): NextResponse | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin) {
    try {
      if (new URL(origin).origin !== requestUrl.origin) {
        return NextResponse.json(
          { error: "Cross-origin request rejected." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }
  } else if (referer) {
    try {
      if (new URL(referer).origin !== requestUrl.origin) {
        return NextResponse.json(
          { error: "Cross-origin request rejected." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid request referrer." },
        { status: 403 }
      );
    }
  }

  if (fetchSite === "cross-site") {
    return NextResponse.json(
      { error: "Cross-site request rejected." },
      { status: 403 }
    );
  }

  return null;
}