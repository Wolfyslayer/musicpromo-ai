import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const STORAGE_PREFIX = "musicpromo_onboarding_tutorial_v1";
const META_KEY = "onboarding_tutorial_v1";

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function readLocalOnboardingComplete(userId) {
  if (!userId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeLocalOnboardingComplete(userId) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

function metadataComplete(meta) {
  if (!meta || typeof meta !== "object") return false;
  return meta[META_KEY] === true || Boolean(meta[`${META_KEY}_at`]);
}

/** True when this account has finished or skipped the first-login tutorial. */
export async function isOnboardingTutorialComplete(userId) {
  if (!userId) return true;
  if (readLocalOnboardingComplete(userId)) return true;

  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user || data.user.id !== userId) return false;
    const done = metadataComplete(data.user.user_metadata);
    if (done) writeLocalOnboardingComplete(userId);
    return done;
  } catch {
    return false;
  }
}

/** Persist completion (skip or finish) so the tutorial only shows once per account. */
export async function markOnboardingTutorialComplete(userId) {
  if (!userId) return;
  writeLocalOnboardingComplete(userId);

  if (!isSupabaseConfigured || !supabase) return;

  try {
    const { data } = await supabase.auth.getUser();
    if (!data?.user || data.user.id !== userId) return;
    if (metadataComplete(data.user.user_metadata)) return;

    const at = new Date().toISOString();
    await supabase.auth.updateUser({
      data: {
        ...data.user.user_metadata,
        [META_KEY]: true,
        [`${META_KEY}_at`]: at,
      },
    });
  } catch (err) {
    console.warn("[onboarding] could not sync profile metadata", err?.message || err);
  }
}
