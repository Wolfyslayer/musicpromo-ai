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

export async function createPromoSwapRequest(targetUserId, message, campaignId = null) {
  const res = await db.functions.invoke("createPromoSwapRequest", {
    targetUserId,
    message,
    campaignId,
  });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not send request.");
  return body;
}

export async function loadPromoSwapRequests() {
  const res = await db.functions.invoke("listPromoSwapRequests", {});
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not load inbox.");
  return {
    incoming: body.incoming || [],
    outgoing: body.outgoing || [],
    pendingIncoming: body.pendingIncoming || 0,
  };
}

export async function respondPromoSwapRequest(requestId, action) {
  const res = await db.functions.invoke("respondPromoSwapRequest", { requestId, action });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not update request.");
  return body;
}

export async function loadCommunityCircles() {
  const res = await db.functions.invoke("listCommunityCircles", {});
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not load circles.");
  return { circles: body.circles || [] };
}

export async function createCommunityCircle(name) {
  const res = await db.functions.invoke("createCommunityCircle", { name });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not create circle.");
  return body.circle;
}

export async function joinCommunityCircle(inviteCode) {
  const res = await db.functions.invoke("joinCommunityCircle", { inviteCode });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not join circle.");
  return body;
}

export async function loadCircleFeed(circleId) {
  const res = await db.functions.invoke("getCircleFeed", { circleId });
  const body = unwrap(res);
  if (body?.error && !body?.ok) throw new Error(body.error || "Could not load circle feed.");
  return { items: body.items || [] };
}

export async function loadLaunchDigest() {
  const res = await db.functions.invoke("getLaunchDigest", {});
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not load digest.");
  return body.digest;
}

export async function loadDailyStatsDigest() {
  const res = await db.functions.invoke("getDailyStatsDigest", {});
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not load daily stats.");
  return body.digest;
}
