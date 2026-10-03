const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

export function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

/** Normalize user input to a stored handle (no @). Empty string clears handle. */
export function normalizeHandleInput(raw) {
  let h = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
  h = h.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return h.slice(0, 24);
}

export function validateHandle(handle) {
  const h = String(handle || "").trim();
  if (!h) return { ok: true, handle: "" };
  if (!HANDLE_RE.test(h)) {
    return {
      ok: false,
      error: "Handle must be 3–24 characters: lowercase letters, numbers, and underscores.",
    };
  }
  return { ok: true, handle: h };
}

export function profilePublicPath(profileOrUser) {
  const handle = profileOrUser?.handle ? String(profileOrUser.handle).trim() : "";
  const id = profileOrUser?.id ? String(profileOrUser.id) : "";
  if (handle) return `/profile/${handle}`;
  if (id) return `/profile/${id}`;
  return "/profile";
}

export function formatHandleLabel(handle) {
  const h = String(handle || "").trim();
  return h ? `@${h}` : "";
}

/** Full shareable URL for a public profile (respects Vite base path). */
export function absoluteProfileUrl(profileOrUser) {
  if (typeof window === "undefined") return profilePublicPath(profileOrUser);
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  const path = profilePublicPath(profileOrUser).replace(/^\//, "");
  return new URL(`${base}${path}`, window.location.origin).href;
}
