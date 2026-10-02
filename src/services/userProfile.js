import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { db } from "@/api/base44Client";

function googleAvatarFromSessionUser(sessionUser) {
  const meta = sessionUser?.user_metadata || {};
  return String(meta.avatar_url || meta.picture || "").trim();
}

export async function fetchOwnProfile(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) return null;
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, full_name, display_name, avatar_url, avatar_override, bio, profile_public, hide_artists_on_profile, role"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Apply Google profile photo when the user has not uploaded a custom avatar. */
export async function syncGoogleAvatarIfNeeded(sessionUser) {
  if (!sessionUser?.id || !supabase) return;
  const googleUrl = googleAvatarFromSessionUser(sessionUser);
  if (!googleUrl) return;

  const row = await fetchOwnProfile(sessionUser.id);
  if (row?.avatar_override) return;

  const { error } = await supabase
    .from("users")
    .update({ avatar_url: googleUrl, avatar_override: false })
    .eq("id", sessionUser.id);
  if (error) console.warn("[profile] google avatar sync", error.message);
}

export async function updateOwnProfile(userId, patch) {
  if (!supabase || !userId) throw new Error("Sign in to update your profile.");
  const allowed = {};
  if (patch.display_name != null) allowed.display_name = String(patch.display_name).slice(0, 80);
  if (patch.bio != null) allowed.bio = String(patch.bio).slice(0, 500);
  if (patch.profile_public != null) allowed.profile_public = Boolean(patch.profile_public);
  if (patch.hide_artists_on_profile != null) {
    allowed.hide_artists_on_profile = Boolean(patch.hide_artists_on_profile);
  }
  if (patch.avatar_url != null) {
    allowed.avatar_url = String(patch.avatar_url);
    allowed.avatar_override = Boolean(patch.avatar_override ?? true);
  }

  const { data, error } = await supabase.from("users").update(allowed).eq("id", userId).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function uploadProfileAvatar(userId, file) {
  if (!supabase || !userId || !file) throw new Error("Choose an image to upload.");
  const ext = file.name?.split(".").pop() || "jpg";
  const path = `${userId}/profile/avatar-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("music-promo-assets").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (upErr) throw new Error(upErr.message);
  const { data } = supabase.storage.from("music-promo-assets").getPublicUrl(path);
  const url = data?.publicUrl || "";
  if (!url) throw new Error("Upload succeeded but no public URL was returned.");
  return updateOwnProfile(userId, { avatar_url: url, avatar_override: true });
}

export async function fetchPublicProfile(userId) {
  const res = await db.functions.invoke("getPublicProfile", { userId });
  const body = res?.data ?? res;
  return body;
}

export async function deleteAccount() {
  const res = await db.functions.invoke("deleteAccount", { confirm: "DELETE" });
  const body = res?.data ?? res;
  if (!body?.ok) throw new Error(body?.error || "Could not delete account.");
  return body;
}

export function profileDisplayName(profile, fallbackUser) {
  return (
    profile?.display_name ||
    profile?.full_name ||
    fallbackUser?.full_name ||
    fallbackUser?.email?.split("@")[0] ||
    "Artist"
  );
}
