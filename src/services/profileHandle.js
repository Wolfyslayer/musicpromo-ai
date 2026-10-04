const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

export const PENDING_SIGNUP_HANDLE_KEY = "musicpromo_pending_signup_handle";

/** Blocked public handles (routes, product names, abuse). */
export const RESERVED_HANDLES = new Set([
  "admin",
  "support",
  "help",
  "api",
  "login",
  "register",
  "signup",
  "sign_up",
  "profile",
  "community",
  "settings",
  "dashboard",
  "create",
  "social",
  "campaigns",
  "releases",
  "analytics",
  "musicpromo",
  "musicpromoai",
  "null",
  "undefined",
  "me",
  "you",
  "root",
  "system",
]);

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

export function isReservedHandle(handle) {
  return RESERVED_HANDLES.has(String(handle || "").trim().toLowerCase());
}

export function validateHandle(handle, { required = false } = {}) {
  const h = String(handle || "").trim();
  if (!h) {
    if (required) return { ok: false, error: "Choose a username for your @handle." };
    return { ok: true, handle: "" };
  }
  if (!HANDLE_RE.test(h)) {
    return {
      ok: false,
      error: "Handle must be 3–24 characters: lowercase letters, numbers, and underscores.",
    };
  }
  if (isReservedHandle(h)) {
    return { ok: false, error: "That handle is reserved. Try another one." };
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
