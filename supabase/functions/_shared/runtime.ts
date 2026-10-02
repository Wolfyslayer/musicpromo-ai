import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { invokeLlm } from "./invokeLlm.ts";

/**
 * Drop-in stand-in for the Base44 request client and secrets runtime.
 * Function handlers keep their existing calls; this module talks to Postgres,
 * Storage, and an OpenAI-compatible chat API.
 */
export const secrets = {
  get(name: string): string {
    return Deno.env.get(name) || "";
  },
};

const SPECS: Record<string, { table: string; kind: string | null; touchUpdated: boolean }> = {
  Artist: { table: "prepared_media", kind: "artist", touchUpdated: true },
  Song: { table: "prepared_media", kind: "song", touchUpdated: true },
  Release: { table: "prepared_media", kind: "release", touchUpdated: true },
  VideoProject: { table: "prepared_media", kind: "video", touchUpdated: true },
  PreparedMedia: { table: "prepared_media", kind: "asset", touchUpdated: true },
  Campaign: { table: "campaign_days", kind: "campaign", touchUpdated: true },
  CampaignDay: { table: "campaign_days", kind: "day", touchUpdated: true },
  GeneratedContent: { table: "campaign_days", kind: "content", touchUpdated: true },
  SocialPost: { table: "campaign_days", kind: "post", touchUpdated: true },
  SocialOAuthState: { table: "campaign_days", kind: "oauth_state", touchUpdated: true },
  AutomationCheckpoint: { table: "campaign_days", kind: "checkpoint", touchUpdated: true },
  SocialAccount: { table: "social_accounts", kind: null, touchUpdated: false },
  AnalyticsEntry: { table: "analytics_entries", kind: null, touchUpdated: false },
};

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("Supabase service credentials are missing in the function environment.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function asUuid(value: unknown): string | null {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function toJson(value: unknown): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === "function") return undefined;
      if (typeof Blob !== "undefined" && item instanceof Blob) return undefined;
      return item;
    })
  );
}

function hydrate(row: Record<string, unknown> | null) {
  if (!row) return null;
  const payload = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
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

function matches(row: Record<string, unknown>, query: Record<string, unknown>) {
  return Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
}

function entityApi(supabase: SupabaseClient, name: string) {
  const spec = SPECS[name];
  if (!spec) {
    throw new Error(`No Supabase table is mapped for ${name}.`);
  }

  async function rows() {
    let query = supabase.from(spec.table).select("*").limit(1000);
    if (spec.kind) query = query.eq("kind", spec.kind);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map((row) => hydrate(row) as Record<string, unknown>);
  }

  return {
    async get(id: string) {
      const { data, error } = await supabase.from(spec.table).select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || (spec.kind && data.kind !== spec.kind)) throw new Error(`${name} not found`);
      return hydrate(data);
    },
    async filter(query: Record<string, unknown>) {
      return (await rows()).filter((row) => matches(row, query));
    },
    async create(payload: Record<string, unknown> = {}) {
      const id = String(payload.id || crypto.randomUUID());
      const userId = asUuid(payload.user_id);
      if (!userId) throw new Error(`${name} requires user_id.`);
      const data = toJson({ ...payload, id });
      const row: Record<string, unknown> = {
        id,
        user_id: userId,
        data,
      };
      if (spec.kind) row.kind = spec.kind;
      if (spec.table !== "social_accounts") row.campaign_id = asUuid(payload.campaign_id);
      if (spec.table === "prepared_media") {
        row.public_url = payload.public_url || payload.media_url || payload.file_url || null;
      }
      if (spec.table === "social_accounts") {
        row.platform = payload.platform || payload.provider || null;
      }
      const { error } = await supabase.from(spec.table).insert(row);
      if (error) throw new Error(error.message);
      return hydrate({ ...row, created_at: new Date().toISOString() });
    },
    async update(id: string, patch: Record<string, unknown> = {}) {
      const existing = (await this.get(id)) as Record<string, unknown>;
      const data = toJson({ ...existing, ...patch, id });
      const next: Record<string, unknown> = { data };
      if (spec.touchUpdated) next.updated_at = new Date().toISOString();
      if (spec.table !== "social_accounts") next.campaign_id = asUuid(data.campaign_id);
      if (spec.table === "prepared_media") {
        next.public_url = data.public_url || data.media_url || data.file_url || null;
      }
      if (spec.table === "social_accounts") next.platform = data.platform || data.provider || null;
      const { error } = await supabase.from(spec.table).update(next).eq("id", id);
      if (error) throw new Error(error.message);
      return { ...data, id };
    },
    async delete(id: string) {
      const { error } = await supabase.from(spec.table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

async function uploadPublicFile(file: File) {
  const supabase = serviceClient();
  const safeName = String(file?.name || "file").replace(/[^\w.\-]+/g, "_");
  const path = `prepared/${crypto.randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage.from("music-promo-assets").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("music-promo-assets").getPublicUrl(path);
  return { file_url: data.publicUrl, url: data.publicUrl };
}

export function createClientFromRequest(req: Request) {
  const supabase = serviceClient();
  const userPromise = (async () => {
    const header = req.headers.get("Authorization") || "";
    const token = header.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email || "",
      role: "artist",
    };
  })();

  const entities = new Proxy(
    {},
    {
      get(_target, prop) {
        return entityApi(supabase, String(prop));
      },
    }
  );

  const core = {
    InvokeLLM: invokeLlm,
    UploadPublicFile: async ({ file }: { file: File }) => uploadPublicFile(file),
    UploadFile: async ({ file }: { file: File }) => uploadPublicFile(file),
  };

  return {
    auth: { me: () => userPromise },
    asServiceRole: {
      entities,
      integrations: { Core: core },
    },
  };
}
