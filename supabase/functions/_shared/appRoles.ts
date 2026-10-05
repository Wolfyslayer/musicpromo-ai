import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** App roles stored on public.users.role and/or auth.users.app_metadata.role (Dashboard only). */
export const APP_ROLES = ["artist", "dev", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

const BILLING_BYPASS = new Set<AppRole>(["dev", "admin"]);

export function normalizeAppRole(raw: unknown): AppRole {
  const r = String(raw || "artist")
    .trim()
    .toLowerCase();
  if (r === "dev" || r === "admin") return r;
  return "artist";
}

export function roleBypassesBilling(role: AppRole): boolean {
  return BILLING_BYPASS.has(role);
}

function bypassUserIdsFromEnv(): Set<string> {
  const raw = (Deno.env.get("BILLING_BYPASS_USER_IDS") || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Resolve role: JWT app_metadata → public.users → env allowlist → artist. */
export async function resolveAppRole(admin: SupabaseClient, userId: string): Promise<AppRole> {
  if (bypassUserIdsFromEnv().has(userId)) return "dev";

  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (!error && data?.user?.app_metadata?.role != null) {
      return normalizeAppRole(data.user.app_metadata.role);
    }
  } catch {
    /* fall through */
  }

  const { data: profile } = await admin.from("users").select("role").eq("id", userId).maybeSingle();
  return normalizeAppRole(profile?.role);
}

export async function isBillingExempt(admin: SupabaseClient, userId: string): Promise<boolean> {
  const role = await resolveAppRole(admin, userId);
  return roleBypassesBilling(role);
}
