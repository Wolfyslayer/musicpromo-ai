import { db } from "@/api/base44Client";

export async function loadCommunityMembers() {
  const res = await db.functions.invoke("listCommunityProfiles", {});
  const body = res?.data ?? res;
  if (!body?.ok) throw new Error(body?.error || "Could not load community.");
  return body.members || [];
}
