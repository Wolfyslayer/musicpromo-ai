// deno-lint-ignore no-explicit-any
type Base44Client = any;

export const PUBLISH_INFLIGHT_MS = 4 * 60 * 1000;

export function normalizePublishProvider(raw: unknown): string {
  const p = String(raw || "").toLowerCase().trim();
  if (p === "twitter") return "x";
  return p;
}

export function dayProviderKey(dayId: string, provider: string): string {
  return `${dayId}:${provider}`;
}

export async function listPostsForDayProvider(
  base44: Base44Client,
  dayId: string,
  provider: string,
  userId?: string
): Promise<Record<string, unknown>[]> {
  const filter: Record<string, unknown> = { campaign_day_id: dayId, provider };
  if (userId) filter.user_id = userId;
  return (
    (await base44.asServiceRole.entities.SocialPost.filter(filter, "-created_date", 24)) || []
  );
}

export async function findPublishedSiblingPost(
  base44: Base44Client,
  post: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const dayId = post.campaign_day_id ? String(post.campaign_day_id) : "";
  const provider = normalizePublishProvider(post.provider);
  if (!dayId || !provider) return null;
  const siblings = await listPostsForDayProvider(base44, dayId, provider);
  for (const row of siblings) {
    if (String(row.id) === String(post.id)) continue;
    if (String(row.status) === "published" || row.external_post_id) return row;
  }
  return null;
}

/** Another row for this day+platform is mid-upload (recent publishing or provider container id). */
export async function findInflightSiblingPost(
  base44: Base44Client,
  post: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const dayId = post.campaign_day_id ? String(post.campaign_day_id) : "";
  const provider = normalizePublishProvider(post.provider);
  if (!dayId || !provider) return null;
  const siblings = await listPostsForDayProvider(base44, dayId, provider);
  const now = Date.now();
  for (const row of siblings) {
    if (String(row.id) === String(post.id)) continue;
    if (String(row.status) === "published" || row.external_post_id) return row;
    if (String(row.status) === "publishing") {
      const updatedAt = Date.parse(String(row.updated_date || row.created_date || ""));
      if (!Number.isNaN(updatedAt) && now - updatedAt < PUBLISH_INFLIGHT_MS) return row;
    }
    if (row.container_id && String(row.status) === "failed") {
      const updatedAt = Date.parse(String(row.updated_date || row.created_date || ""));
      if (!Number.isNaN(updatedAt) && now - updatedAt < PUBLISH_INFLIGHT_MS) return row;
    }
  }
  return null;
}

/** Mark extra scheduled/draft rows for the same day+provider as superseded (prevents double upload). */
export async function supersedeDuplicateQueuePosts(
  base44: Base44Client,
  keeperPostId: string,
  dayId: string,
  provider: string
): Promise<number> {
  const siblings = await listPostsForDayProvider(base44, dayId, provider);
  let n = 0;
  for (const row of siblings) {
    if (String(row.id) === String(keeperPostId)) continue;
    const st = String(row.status || "");
    if (!["scheduled", "draft", "failed"].includes(st)) continue;
    if (row.external_post_id) continue;
    await base44.asServiceRole.entities.SocialPost.update(row.id, {
      status: "failed",
      scheduled_at: "",
      error_code: "DUPLICATE_SUPERSEDED",
      error_message: "Duplicate queue row cancelled — another post is publishing for this day.",
    });
    n += 1;
  }
  return n;
}

export function dedupePostsByDayProvider(posts: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const p of posts) {
    const dayId = p.campaign_day_id ? String(p.campaign_day_id) : "";
    const provider = normalizePublishProvider(p.provider);
    if (!dayId || !provider) {
      out.push(p);
      continue;
    }
    const key = dayProviderKey(dayId, provider);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export const TIKTOK_UPLOADED_SUFFIX = "|uploaded";

export function tiktokContainerUploaded(containerId: string): boolean {
  return String(containerId || "").includes(TIKTOK_UPLOADED_SUFFIX);
}

export function tiktokPublishIdFromContainer(containerId: string): string {
  return String(containerId || "").split(TIKTOK_UPLOADED_SUFFIX)[0].trim();
}

export function markTikTokContainerUploaded(containerId: string): string {
  const id = tiktokPublishIdFromContainer(containerId);
  return id ? `${id}${TIKTOK_UPLOADED_SUFFIX}` : "";
}

export function looksLikeYouTubeVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{8,}$/.test(String(id || "").trim());
}
