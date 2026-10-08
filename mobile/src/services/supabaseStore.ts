import { requireSupabase, supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export const PROMO_BUCKET = "music-promo-assets";

let workspaceEffectiveUserId: string | null = null;

export function setWorkspaceEffectiveUserId(userId: string | null) {
  workspaceEffectiveUserId = userId ? String(userId) : null;
}

export function getWorkspaceEffectiveUserId() {
  return workspaceEffectiveUserId;
}

const SPECS: Record<string, { table: string; kind: string | null }> = {
  Artist: { table: "prepared_media", kind: "artist" },
  Song: { table: "prepared_media", kind: "song" },
  Release: { table: "prepared_media", kind: "release" },
  VideoProject: { table: "prepared_media", kind: "video" },
  Campaign: { table: "campaign_days", kind: "campaign" },
  CampaignDay: { table: "campaign_days", kind: "day" },
  GeneratedContent: { table: "campaign_days", kind: "content" },
  AnalyticsEntry: { table: "analytics_entries", kind: null },
  SocialAccount: { table: "social_accounts", kind: null },
};

async function currentUserId() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  return data?.user?.id || null;
}

async function effectiveUserId() {
  const self = await currentUserId();
  if (!self) return null;
  if (workspaceEffectiveUserId && workspaceEffectiveUserId !== self) return workspaceEffectiveUserId;
  return self;
}

async function requireUserId() {
  const userId = await effectiveUserId();
  if (!userId) throw new Error("Sign in to save.");
  return userId;
}

function toJson(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === "function") return undefined;
      return item;
    })
  );
}

function hydrate(row: Record<string, unknown> | null) {
  if (!row) return null;
  const payload =
    row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return {
    ...payload,
    id: row.id,
    user_id: row.user_id,
    campaign_id: row.campaign_id ?? payload.campaign_id ?? null,
    public_url: row.public_url || payload.public_url || null,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function sortRows(rows: Record<string, unknown>[], sort?: string) {
  if (!sort) return rows;
  const desc = String(sort).startsWith("-");
  const key = desc ? String(sort).slice(1) : String(sort);
  const field = key === "created_date" ? "created_date" : key;
  return [...rows].sort((a, b) => {
    const av = (a?.[field] as string) ?? "";
    const bv = (b?.[field] as string) ?? "";
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function matches(row: Record<string, unknown>, query: Record<string, unknown>) {
  return Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
}

function columnExtras(spec: { table: string }, data: Record<string, unknown>) {
  const extras: Record<string, unknown> = {};
  if (
    spec.table === "campaign_days" ||
    spec.table === "prepared_media" ||
    spec.table === "analytics_entries"
  ) {
    extras.campaign_id = data.campaign_id || null;
  }
  if (spec.table === "prepared_media") {
    extras.public_url =
      data.artwork_url || data.audio_url || data.file_url || data.public_url || null;
  }
  if (spec.table === "social_accounts") {
    extras.platform = data.platform || null;
  }
  return extras;
}

async function fetchRows(spec: { table: string; kind: string | null }) {
  const userId = await effectiveUserId();
  if (!userId) return [];
  let query = requireSupabase().from(spec.table).select("*").eq("user_id", userId);
  if (spec.kind) query = query.eq("kind", spec.kind);
  const { data, error } = await query.limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => hydrate(row as Record<string, unknown>)!);
}

function entity(name: string) {
  const spec = SPECS[name];

  return {
    async list(sort?: string, limit?: number) {
      const rows = sortRows(await fetchRows(spec), sort);
      return typeof limit === "number" ? rows.slice(0, limit) : rows;
    },

    async filter(query: Record<string, unknown>, sort?: string, limit?: number) {
      const rows = sortRows(await fetchRows(spec), sort).filter((row) => matches(row, query));
      return typeof limit === "number" ? rows.slice(0, limit) : rows;
    },

    async get(id: string) {
      const { data, error } = await requireSupabase()
        .from(spec.table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || (spec.kind && (data as { kind?: string }).kind !== spec.kind)) {
        const err = new Error("Not found") as Error & { status?: number };
        err.status = 404;
        throw err;
      }
      return hydrate(data as Record<string, unknown>)!;
    },

    async create(payload: Record<string, unknown> = {}) {
      const userId = await requireUserId();
      const id = (payload.id as string) || crypto.randomUUID();
      const data = toJson({ ...payload, id }) as Record<string, unknown>;
      const row = {
        id,
        user_id: userId,
        data,
        ...(spec.kind ? { kind: spec.kind } : {}),
        ...columnExtras(spec, data),
      };
      const { error } = await requireSupabase().from(spec.table).insert(row);
      if (error) throw new Error(error.message);
      return hydrate({
        ...row,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })!;
    },

    async update(id: string, patch: Record<string, unknown> = {}) {
      const existing = await this.get(id);
      const data = toJson({ ...existing, ...patch, id }) as Record<string, unknown>;
      const { error } = await requireSupabase()
        .from(spec.table)
        .update({
          data,
          updated_at: new Date().toISOString(),
          ...columnExtras(spec, data),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { ...data, id };
    },

    async delete(id: string) {
      const { error } = await requireSupabase().from(spec.table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async deleteMany(query: Record<string, unknown>) {
      const found = await this.filter(query);
      if (!found.length) return;
      const { error } = await requireSupabase()
        .from(spec.table)
        .delete()
        .in(
          "id",
          found.map((row) => row.id as string)
        );
      if (error) throw new Error(error.message);
    },
  };
}

export function createEntityApi() {
  return {
    Artist: entity("Artist"),
    Song: entity("Song"),
    Release: entity("Release"),
    VideoProject: entity("VideoProject"),
    Campaign: entity("Campaign"),
    CampaignDay: entity("CampaignDay"),
    GeneratedContent: entity("GeneratedContent"),
    AnalyticsEntry: entity("AnalyticsEntry"),
    SocialAccount: entity("SocialAccount"),
  };
}

export type UploadProgress = { loaded: number; total: number; progress: number };

export type UploadableFile = {
  uri: string;
  name: string;
  type?: string;
};

/** Upload into public music-promo-assets — same path contract as web. */
export async function uploadPromoAsset(
  file: UploadableFile,
  folder = "assets",
  options?: {
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
  }
) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to upload.");
  }
  const userId = await requireUserId();
  const safeName = String(file?.name || "file").replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${folder}/${Date.now()}-${safeName}`;

  if (options?.signal?.aborted) {
    throw new Error("Upload cancelled.");
  }

  options?.onProgress?.({ loaded: 0, total: 1, progress: 0.05 });

  const response = await fetch(file.uri);
  if (!response.ok) throw new Error("Could not read the selected file.");
  const blob = await response.blob();

  if (options?.signal?.aborted) {
    throw new Error("Upload cancelled.");
  }

  options?.onProgress?.({ loaded: 0.4, total: 1, progress: 0.4 });

  const { error } = await supabase.storage.from(PROMO_BUCKET).upload(path, blob, {
    contentType: file?.type || blob.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  options?.onProgress?.({ loaded: 1, total: 1, progress: 1 });

  const { data } = supabase.storage.from(PROMO_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl || "";
  return {
    path,
    publicUrl,
    file_url: publicUrl,
    file_uri: publicUrl,
    signed_url: publicUrl,
  };
}

export async function resolveAssetUrl(fileUri: string) {
  const raw = String(fileUri || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  const client = requireSupabase();
  const { data } = client.storage.from(PROMO_BUCKET).getPublicUrl(raw);
  return data?.publicUrl || raw;
}
