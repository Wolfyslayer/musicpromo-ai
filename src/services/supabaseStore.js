import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export const PROMO_BUCKET = "music-promo-assets";

/**
 * Domain records fold into the five Supabase tables:
 * users, campaign_days, social_accounts, prepared_media, analytics_entries.
 * The original field set lives in `data` so the studio screens keep their shape.
 */
/** When set (verified studio manager), entity reads/writes use this user_id. */
let workspaceEffectiveUserId = null;

export function setWorkspaceEffectiveUserId(userId) {
  workspaceEffectiveUserId = userId ? String(userId) : null;
}

export function getWorkspaceEffectiveUserId() {
  return workspaceEffectiveUserId;
}

const SPECS = {
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

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use the database.");
  }
  return supabase;
}

async function currentUserId() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  return data?.user?.id || null;
}

async function effectiveUserId() {
  const self = await currentUserId();
  if (!self) return null;
  if (workspaceEffectiveUserId && workspaceEffectiveUserId !== self) {
    return workspaceEffectiveUserId;
  }
  return self;
}

async function requireUserId() {
  const userId = await effectiveUserId();
  if (!userId) throw new Error("Sign in to save.");
  return userId;
}

function toJson(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === "function") return undefined;
      if (typeof Blob !== "undefined" && item instanceof Blob) return undefined;
      return item;
    })
  );
}

function hydrate(row) {
  if (!row) return null;
  const payload = row.data && typeof row.data === "object" ? row.data : {};
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

function sortRows(rows, sort) {
  if (!sort) return rows;
  const desc = String(sort).startsWith("-");
  const key = desc ? String(sort).slice(1) : String(sort);
  const field = key === "created_date" ? "created_date" : key;
  return [...rows].sort((a, b) => {
    const av = a?.[field] ?? "";
    const bv = b?.[field] ?? "";
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function matches(row, query) {
  return Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
}

function columnExtras(spec, data) {
  const extras = {};
  if (spec.table === "campaign_days" || spec.table === "prepared_media" || spec.table === "analytics_entries") {
    extras.campaign_id = data.campaign_id || null;
  }
  if (spec.table === "prepared_media") {
    extras.public_url = data.artwork_url || data.audio_url || data.file_url || data.public_url || null;
  }
  if (spec.table === "social_accounts") {
    extras.platform = data.platform || null;
  }
  return extras;
}

async function fetchRows(spec) {
  const userId = await effectiveUserId();
  if (!userId) return [];
  let query = requireClient().from(spec.table).select("*").eq("user_id", userId);
  if (spec.kind) query = query.eq("kind", spec.kind);
  const { data, error } = await query.limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map(hydrate);
}

function entity(name) {
  const spec = SPECS[name];

  return {
    async list(sort, limit) {
      const rows = sortRows(await fetchRows(spec), sort);
      return typeof limit === "number" ? rows.slice(0, limit) : rows;
    },

    async filter(query, sort, limit) {
      const rows = sortRows(await fetchRows(spec), sort).filter((row) => matches(row, query));
      return typeof limit === "number" ? rows.slice(0, limit) : rows;
    },

    async get(id) {
      const { data, error } = await requireClient().from(spec.table).select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || (spec.kind && data.kind !== spec.kind)) {
        const err = new Error("Not found");
        err.status = 404;
        throw err;
      }
      return hydrate(data);
    },

    async create(payload = {}) {
      const userId = await requireUserId();
      const id = payload.id || crypto.randomUUID();
      const data = toJson({ ...payload, id });
      const row = {
        id,
        user_id: userId,
        data,
        ...(spec.kind ? { kind: spec.kind } : {}),
        ...columnExtras(spec, data),
      };
      const { error } = await requireClient().from(spec.table).insert(row);
      if (error) throw new Error(error.message);
      return hydrate({ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    },

    async update(id, patch = {}) {
      const existing = await this.get(id);
      const data = toJson({ ...existing, ...patch, id });
      const { error } = await requireClient()
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

    async delete(id) {
      const { error } = await requireClient().from(spec.table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async bulkCreate(records = []) {
      const userId = await requireUserId();
      const rows = records.map((payload) => {
        const id = payload.id || crypto.randomUUID();
        const data = toJson({ ...payload, id });
        return {
          id,
          user_id: userId,
          data,
          ...(spec.kind ? { kind: spec.kind } : {}),
          ...columnExtras(spec, data),
        };
      });
      if (!rows.length) return [];
      const { error } = await requireClient().from(spec.table).insert(rows);
      if (error) throw new Error(error.message);
      const now = new Date().toISOString();
      return rows.map((row) => hydrate({ ...row, created_at: now, updated_at: now }));
    },

    async deleteMany(query) {
      const matches = await this.filter(query);
      if (!matches.length) return;
      const { error } = await requireClient()
        .from(spec.table)
        .delete()
        .in(
          "id",
          matches.map((row) => row.id)
        );
      if (error) throw new Error(error.message);
    },
  };
}

export const records = {
  users: "users",
  artists: entity("Artist"),
  songs: entity("Song"),
  releases: entity("Release"),
  videos: entity("VideoProject"),
  campaigns: entity("Campaign"),
  days: entity("CampaignDay"),
  content: entity("GeneratedContent"),
  analytics: entity("AnalyticsEntry"),
  socialAccounts: entity("SocialAccount"),
};

export function createEntityApi() {
  return {
    Artist: records.artists,
    Song: records.songs,
    Release: records.releases,
    VideoProject: records.videos,
    Campaign: records.campaigns,
    CampaignDay: records.days,
    GeneratedContent: records.content,
    AnalyticsEntry: records.analytics,
    SocialAccount: records.socialAccounts,
  };
}

/** Upload a WAV/MP3 or JPEG into the public music-promo-assets bucket. */
export async function uploadPromoAsset(file, folder = "assets") {
  const client = requireClient();
  const userId = await requireUserId();
  const safeName = String(file?.name || "file").replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${folder}/${Date.now()}-${safeName}`;
  const { error } = await client.storage.from(PROMO_BUCKET).upload(path, file, {
    contentType: file?.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from(PROMO_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl || "";
  return {
    path,
    publicUrl,
    file_url: publicUrl,
    file_uri: publicUrl,
    signed_url: publicUrl,
  };
}

export async function resolveAssetUrl(fileUri) {
  const raw = String(fileUri || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  const client = requireClient();
  const { data } = client.storage.from(PROMO_BUCKET).getPublicUrl(raw);
  return data?.publicUrl || raw;
}
