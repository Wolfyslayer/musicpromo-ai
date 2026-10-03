import { db } from "@/api/base44Client";

function unwrap(res) {
  return res?.data ?? res;
}

export async function loadCommunityMembers() {
  const res = await db.functions.invoke("listCommunityProfiles", {});
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not load community.");
  return {
    members: body.members || [],
    followingIds: body.followingIds || [],
    spotlight: body.spotlight || { featured: [], recentlyActive: [] },
  };
}

export async function toggleCommunityFollow(followedUserId) {
  const res = await db.functions.invoke("toggleCommunityFollow", { followedUserId });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not update follow.");
  return { following: body.following === true, followedUserId: body.followedUserId };
}

export async function loadCommunityFeed() {
  const res = await db.functions.invoke("getCommunityFeed", {});
  const body = unwrap(res);
  if (body?.error && !body?.ok) throw new Error(body.error || "Could not load feed.");
  return { items: body.items || [] };
}

export async function reportCommunityProfile(reportedUserId, reason, details = "") {
  const res = await db.functions.invoke("reportCommunityProfile", {
    reportedUserId,
    reason,
    details,
  });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not submit report.");
  return body;
}
