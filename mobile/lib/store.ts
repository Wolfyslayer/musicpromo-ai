import * as Crypto from "expo-crypto";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Row, UploadFile } from "@/lib/types";

export const PROMO_BUCKET = "music-promo-assets";

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

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to use the database.");
  }
  return supabase;
}

async function currentUserId() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  return data?.user?.id || null;
}

async function requireUserId() {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to save.");
  return userId;
}

function toJson(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "function" ? undefined : item))
  );
}

function hydrate(row: Row | null) {
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

function sortRows(rows: Row[], sort?: string) {
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

function matches(row: Row, query?: Row) {
  return Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
}

function columnExtras(spec: { table: string }, data: Row) {
  const extras: Row = {};
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

async function fetchRows(spec: { table: string; kind: string | null }) {
  const userId = await currentUserId();
  if (!userId) return [];
  let query = requireClient().from(spec.table).select("*").eq("user_id", userId);
  if (spec.kind) query = query.eq("kind", spec.kind);
  const { data, error } = await query.limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map(hydrate).filter(Boolean) as Row[];
}

function entity(name: string) {
  const spec = SPECS[name];

  return {
    async list(sort?: string, limit?: number) {
      const rows = sortRows(await fetchRows(spec), sort);
      return typeof limit === "number" ? rows.slice(0, limit) : rows;
    },

    async filter(query?: Row, sort?: string, limit?: number) {
      const rows = sortRows(await fetchRows(spec), sort).filter((row) => matches(row, query));
      return typeof limit === "number" ? rows.slice(0, limit) : rows;
    },

    async get(id: string) {
      const { data, error } = await requireClient().from(spec.table).select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || (spec.kind && data.kind !== spec.kind)) {
        throw new Error("Not found");
      }
      return hydrate(data) as Row;
    },

    async create(payload: Row = {}) {
      const userId = await requireUserId();
      const id = payload.id || Crypto.randomUUID();
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
      const now = new Date().toISOString();
      return hydrate({ ...row, created_at: now, updated_at: now }) as Row;
    },

    async update(id: string, patch: Row = {}) {
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

    async delete(id: string) {
      const { error } = await requireClient().from(spec.table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async bulkCreate(records: Row[] = []) {
      const userId = await requireUserId();
      const rows = records.map((payload) => {
        const id = payload.id || Crypto.randomUUID();
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

    async deleteMany(query: Row) {
      const found = await this.filter(query);
      if (!found.length) return;
      const { error } = await requireClient()
        .from(spec.table)
        .delete()
        .in("id", found.map((row) => row.id));
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

export async function uploadArrayBuffer(body: ArrayBuffer, name: string, contentType: string, folder = "assets") {
  const client = requireClient();
  const userId = await requireUserId();
  const safeName = String(name || "file").replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${folder}/${Date.now()}-${safeName}`;
  const { error } = await client.storage.from(PROMO_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from(PROMO_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl || "";
  return { path, publicUrl, file_url: publicUrl };
}

export function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

export async function uploadPromoAsset(file: UploadFile, folder = "assets") {
  const client = requireClient();
  const userId = await requireUserId();
  const safeName = String(file?.name || "file").replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${folder}/${Date.now()}-${safeName}`;
  const response = await fetch(file.uri);
  const body = await response.arrayBuffer();
  const { error } = await client.storage.from(PROMO_BUCKET).upload(path, body, {
    contentType: file?.type || "application/octet-stream",
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
  };
}

export async function resolveAssetUrl(fileUri?: string | null) {
  const raw = String(fileUri || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const client = requireClient();
  const { data } = client.storage.from(PROMO_BUCKET).getPublicUrl(raw);
  return data?.publicUrl || raw;
}
