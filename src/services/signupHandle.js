import { supabase } from "@/lib/supabaseClient";
import {
  normalizeHandleInput,
  PENDING_SIGNUP_HANDLE_KEY,
  validateHandle,
} from "@/services/profileHandle";
import { updateOwnProfile } from "@/services/userProfile";

/** Fields stored on auth.users.user_metadata — available as {{ .Data.* }} in Supabase email templates. */
export function authSignupUserMetadata(rawHandle) {
  const normalized = normalizeHandleInput(rawHandle);
  if (!normalized) return {};
  return {
    pending_handle: normalized,
    /** Used by confirmation email template: {{ .Data.username }} */
    username: normalized,
    handle: normalized,
  };
}

export function stashPendingSignupHandle(rawHandle) {
  if (typeof window === "undefined") return;
  const normalized = normalizeHandleInput(rawHandle);
  const check = validateHandle(normalized, { required: true });
  if (!check.ok) throw new Error(check.error);
  try {
    window.sessionStorage.setItem(PENDING_SIGNUP_HANDLE_KEY, normalized);
  } catch {
    /* ignore */
  }
}

export function clearPendingSignupHandle() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_SIGNUP_HANDLE_KEY);
  } catch {
    /* ignore */
  }
}

export async function checkHandleAvailable(rawHandle) {
  const normalized = normalizeHandleInput(rawHandle);
  const check = validateHandle(normalized, { required: true });
  if (!check.ok) {
    return { available: false, handle: normalized, error: check.error };
  }
  if (!supabase) {
    return { available: false, handle: normalized, error: "Sign-in is not configured." };
  }
  const { data, error } = await supabase.functions.invoke("checkProfileHandle", {
    body: { handle: normalized },
  });
  if (error) {
    return { available: false, handle: normalized, error: error.message || "Could not check handle" };
  }
  const body = data && typeof data === "object" ? data : {};
  return {
    available: Boolean(body.available),
    handle: body.handle || normalized,
    error: body.error || null,
  };
}

/** After sign-up / email verify, persist the chosen @handle (unique enforced by DB). */
export async function applyPendingSignupHandle(userId) {
  if (!userId || typeof window === "undefined") return { ok: true, skipped: true };
  let pending = "";
  try {
    pending = window.sessionStorage.getItem(PENDING_SIGNUP_HANDLE_KEY) || "";
  } catch {
    return { ok: true, skipped: true };
  }
  if (!pending) return { ok: true, skipped: true };

  try {
    await updateOwnProfile(userId, { handle: pending });
    clearPendingSignupHandle();
    return { ok: true, handle: pending };
  } catch (e) {
    return { ok: false, error: e?.message || "Could not save handle" };
  }
}
