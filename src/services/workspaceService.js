import { db } from "@/api/base44Client";

function unwrap(res) {
  return res?.data ?? res;
}

export async function listWorkspaceStudios() {
  const res = await db.functions.invoke("listWorkspaceStudios", {});
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not load team workspaces.");
  return {
    studios: body.studios || [],
    memberships: body.memberships || [],
  };
}

export async function createWorkspaceStudio(name) {
  const res = await db.functions.invoke("createWorkspaceStudio", { name });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not create studio.");
  return body.studio;
}

export async function inviteWorkspaceStudioMember(studioId, email) {
  const res = await db.functions.invoke("inviteWorkspaceStudioMember", { studioId, email });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not invite member.");
  return body;
}

export async function removeWorkspaceStudioMember(studioId, memberUserId) {
  const res = await db.functions.invoke("removeWorkspaceStudioMember", { studioId, memberUserId });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not remove member.");
  return body;
}

export async function verifyWorkspaceAccess(ownerUserId) {
  const res = await db.functions.invoke("verifyWorkspaceAccess", { ownerUserId });
  const body = unwrap(res);
  if (!body?.ok) throw new Error(body?.error || "Could not verify workspace access.");
  return { allowed: body.allowed === true, role: body.role || null };
}
