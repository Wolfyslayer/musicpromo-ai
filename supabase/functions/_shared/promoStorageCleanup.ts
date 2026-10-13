/**
 * music-promo-assets storage cleanup — paths are userId/folder/filename.
 * URLs appear in campaign_days.data, prepared_media.data, and public_url columns.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const PROMO_ASSETS_BUCKET = "music-promo-assets";

const URL_PATH_RE = /music-promo-assets\/([^?#"'\s]+)/gi;
const BARE_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i;

function decodePath(raw: string): string {
  try {
    return decodeURIComponent(raw).replace(/^\/+/, "");
  } catch {
    return raw.replace(/^\/+/, "");
  }
}

export function extractStoragePathsFromString(raw: string): string[] {
  const text = String(raw || "");
  if (!text.trim()) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(URL_PATH_RE)) {
    const p = decodePath(m[1] || "");
    if (p) out.add(p);
  }
  const trimmed = text.trim();
  if (BARE_PATH_RE.test(trimmed) && !trimmed.includes("://")) {
    out.add(trimmed.replace(/^\/+/, ""));
  }
  return [...out];
}

export function extractStoragePathsFromValue(value: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (v == null) return;
    if (typeof v === "string") {
      for (const p of extractStoragePathsFromString(v)) out.add(p);
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (typeof v === "object") {
      for (const val of Object.values(v as Record<string, unknown>)) walk(val);
    }
  };
  walk(value);
  return [...out];
}

function pathsFromDbRow(row: Record<string, unknown>): string[] {
  const parts = [
    row.public_url,
    row.storage_path,
    row.data,
  ];
  const out = new Set<string>();
  for (const p of parts) {
    for (const path of extractStoragePathsFromValue(p)) out.add(path);
  }
  return [...out];
}

async function fetchUserRows(
  admin: SupabaseClient,
  userId: string,
  campaignId?: string | null
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];

  let cd = admin.from("campaign_days").select("id,campaign_id,data").eq("user_id", userId);
  if (campaignId) cd = cd.or(`campaign_id.eq.${campaignId},id.eq.${campaignId}`);
  const { data: campaignDays } = await cd.limit(5000);
  rows.push(...((campaignDays || []) as Record<string, unknown>[]));

  let pm = admin
    .from("prepared_media")
    .select("id,campaign_id,public_url,storage_path,data")
    .eq("user_id", userId);
  if (campaignId) pm = pm.eq("campaign_id", campaignId);
  const { data: media } = await pm.limit(5000);
  rows.push(...((media || []) as Record<string, unknown>[]));

  return rows;
}

export async function collectReferencedStoragePaths(
  admin: SupabaseClient,
  userId: string,
  opts?: { excludeCampaignId?: string }
): Promise<Set<string>> {
  const all = new Set<string>();
  const rows = await fetchUserRows(admin, userId);
  for (const row of rows) {
    const cid = row.campaign_id != null ? String(row.campaign_id) : "";
    if (opts?.excludeCampaignId && cid === opts.excludeCampaignId) continue;
    for (const p of pathsFromDbRow(row)) all.add(p);
  }
  return all;
}

export async function collectCampaignStoragePaths(
  admin: SupabaseClient,
  userId: string,
  campaignId: string
): Promise<Set<string>> {
  const paths = new Set<string>();
  const rows = await fetchUserRows(admin, userId, campaignId);
  for (const row of rows) {
    for (const p of pathsFromDbRow(row)) paths.add(p);
  }
  return paths;
}

export async function deleteStoragePaths(
  admin: SupabaseClient,
  paths: string[]
): Promise<{ deleted: number; errors: string[] }> {
  const unique = [...new Set(paths.map((p) => String(p || "").trim()).filter(Boolean))];
  if (!unique.length) return { deleted: 0, errors: [] };
  const errors: string[] = [];
  let deleted = 0;
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { error } = await admin.storage.from(PROMO_ASSETS_BUCKET).remove(chunk);
    if (error) errors.push(error.message);
    else deleted += chunk.length;
  }
  return { deleted, errors };
}

/** Delete bucket objects tied to a campaign that no other row still references. */
export async function purgeCampaignStorage(
  admin: SupabaseClient,
  userId: string,
  campaignId: string
): Promise<{ deleted: number; paths: string[]; skipped: string[]; errors: string[] }> {
  const campaignPaths = await collectCampaignStoragePaths(admin, userId, campaignId);
  const stillUsed = await collectReferencedStoragePaths(admin, userId, {
    excludeCampaignId: campaignId,
  });
  const toDelete = [...campaignPaths].filter((p) => !stillUsed.has(p));
  const skipped = [...campaignPaths].filter((p) => stillUsed.has(p));
  const { deleted, errors } = await deleteStoragePaths(admin, toDelete);
  return { deleted, paths: toDelete, skipped, errors };
}

/** Orphan = object in bucket under userId/ with no reference in DB json. */
export async function purgeOrphanPromoAssetsForUser(
  admin: SupabaseClient,
  userId: string
): Promise<{ deleted: number; paths: string[]; errors: string[] }> {
  const { data, error } = await admin.rpc("list_orphan_promo_storage", {
    p_user_id: userId,
  });
  if (error) {
    const referenced = await collectReferencedStoragePaths(admin, userId);
    const { data: objects, error: listErr } = await admin.storage.from(PROMO_ASSETS_BUCKET).list(userId, {
      limit: 1000,
    });
    if (listErr) throw new Error(listErr.message);
    const orphanPaths: string[] = [];
    for (const entry of objects || []) {
      if (entry.id == null) continue;
      const objectPath = `${userId}/${entry.name}`;
      if (!referenced.has(objectPath)) orphanPaths.push(objectPath);
    }
    const { deleted, errors } = await deleteStoragePaths(admin, orphanPaths);
    return { deleted, paths: orphanPaths, errors };
  }
  const paths = (data || []).map((row: { object_name: string }) => String(row.object_name || "")).filter(Boolean);
  const { deleted, errors } = await deleteStoragePaths(admin, paths);
  return { deleted, paths, errors };
}
