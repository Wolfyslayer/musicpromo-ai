import { db } from "@/api/base44Client";

export async function fetchSunoStatus() {
  const res = await db.functions.invoke("generateSunoTrack", { action: "status" });
  return res.data;
}

export async function generateSunoTrack(payload) {
  const res = await db.functions.invoke("generateSunoTrack", payload);
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
  return res.data;
}
