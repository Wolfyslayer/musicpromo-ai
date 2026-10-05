import { db } from "@/api/base44Client";

export async function fetchSunoStatus() {
  const res = await db.functions.invoke("generateSunoTrack", { action: "status" });
  return res.data;
}

function throwIfInvokeError(data) {
  if (data && typeof data === "object" && data.error && data.ok !== true) {
    const err = new Error(String(data.error));
    err.status = data.code === "INSUFFICIENT_CREDITS" ? 402 : data.code === "PREMIUM_REQUIRED" ? 403 : 500;
    err.data = data;
    throw err;
  }
}

export async function generateSunoTrack(payload) {
  const res = await db.functions.invoke("generateSunoTrack", payload);
  throwIfInvokeError(res.data);
  return res.data;
}

export async function fetchStemSplitStatus() {
  const res = await db.functions.invoke("splitAudioStems", { action: "status" });
  return res.data;
}

export async function splitAudioStems({ audioUrl, songId } = {}) {
  const payload = {};
  if (songId) payload.songId = String(songId);
  else if (audioUrl) payload.audioUrl = String(audioUrl).trim();
  const res = await db.functions.invoke("splitAudioStems", payload);
  throwIfInvokeError(res.data);
  return res.data;
}
