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

export async function splitAudioStems({ audioUrl }) {
  const res = await db.functions.invoke("splitAudioStems", { audioUrl });
  return res.data;
}
