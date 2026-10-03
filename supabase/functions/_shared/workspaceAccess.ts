import { serviceClient } from "./runtime.ts";

/** True when auth user may read/write rows owned by ownerUserId (self or studio manager). */
export async function studioCanAccessOwner(
  authUserId: string,
  ownerUserId: string
): Promise<boolean> {
  if (!authUserId || !ownerUserId) return false;
  if (authUserId === ownerUserId) return true;

  const admin = serviceClient();
  const { data: studios } = await admin
    .from("workspace_studios")
    .select("id")
    .eq("owner_id", ownerUserId);
  const studioIds = (studios || []).map((s) => s.id);
  if (!studioIds.length) return false;

  const { data: member } = await admin
    .from("workspace_studio_members")
    .select("role")
    .eq("user_id", authUserId)
    .in("studio_id", studioIds)
    .maybeSingle();

  return member?.role === "owner" || member?.role === "manager";
}
