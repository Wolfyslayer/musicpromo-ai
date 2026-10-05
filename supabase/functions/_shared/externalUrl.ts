/** Normalize host/base URLs from secrets (users often omit https://). */
export function normalizeExternalBaseUrl(raw: string, fallback = ""): string {
  let s = String(raw || "").trim();
  if (!s) {
    if (!fallback) return "";
    return normalizeExternalBaseUrl(fallback);
  }
  s = s.replace(/\/+$/, "");
  if (/^\/\//.test(s)) s = `https:${s}`;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const url = new URL(s);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "") || url.origin;
  } catch {
    throw new Error(
      `Invalid URL base "${raw}". Use a full URL like https://api.tempolor.com (include https://).`
    );
  }
}

/** TemPolor expects the raw API key in Authorization (not Bearer). */
export function normalizeApiKey(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^Token\s+/i, "");
}
