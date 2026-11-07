const ALLOWED_URL = "https://www.pc.gov.pk/web/tender";
const ALLOWED_HOST = "www.pc.gov.pk";
const ALLOWED_PATH = "/web/tender";
const MAX_RESPONSE_BYTES = 1_000_000;

export class TenderCheckError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TenderCheckError";
    this.status = status;
  }
}

export type TenderCheckResult = {
  success: true;
  url: string;
  checkedAt: string;
  title: string;
  fingerprint: string;
  preview: string;
  contentText: string;
  note: string;
};

export function isSupportedTenderUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.href === ALLOWED_URL &&
      parsed.protocol === "https:" &&
      parsed.hostname.toLowerCase() === ALLOWED_HOST &&
      parsed.pathname === ALLOWED_PATH &&
      parsed.port === "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

export async function checkTenderPage(
  url: string
): Promise<TenderCheckResult> {
  if (!isSupportedTenderUrl(url)) {
    throw new TenderCheckError(
      `This demo currently supports only ${ALLOWED_URL}`,
      400
    );
  }

  let response: Response;

  try {
    response = await fetch(ALLOWED_URL, {
      headers: {
        "User-Agent": "TenderWatchMVP/1.0",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    throw new TenderCheckError(
      message.toLowerCase().includes("timeout")
        ? "The website took too long to respond."
        : "The page could not be checked. It may block automated requests.",
      502
    );
  }

  if (!response.ok) {
    throw new TenderCheckError(
      `The website returned HTTP ${response.status}. It may block automated checks.`,
      502
    );
  }

  const contentType = response.headers.get("content-type") || "";

  if (
    !contentType.includes("text/html") &&
    !contentType.includes("text/plain")
  ) {
    throw new TenderCheckError(
      "The page did not return readable HTML or text.",
      415
    );
  }

  const declaredLength = Number(response.headers.get("content-length") || 0);

  if (declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new TenderCheckError(
      "The page is larger than the supported 1 MB limit.",
      413
    );
  }

  if (!response.body) {
    throw new TenderCheckError(
      "The website returned an empty response.",
      502
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new TenderCheckError(
          "The page is larger than the supported 1 MB limit.",
          413
        );
      }

      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof TenderCheckError) throw error;

    throw new TenderCheckError(
      "The page could not be downloaded completely.",
      502
    );
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const html = new TextDecoder("utf-8").decode(bytes);

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
    throw new TenderCheckError(
      "No readable page text was found.",
      422
    );
  }

  const digest = await globalThis.crypto.subtle.digest(
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

  return {
    success: true,
    url: ALLOWED_URL,
    checkedAt: new Date().toISOString(),
    title,
    fingerprint,
    preview: text.slice(0, 350),
    contentText: text,
    note:
      "Page-text snapshot only. A difference indicates a possible change, not a verified tender amendment.",
  };
}