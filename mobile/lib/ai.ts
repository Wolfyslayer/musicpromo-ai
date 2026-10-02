import { db } from "@/lib/db";
import type { Row } from "@/lib/types";

const invoke = async (name: string, payload?: Row) => {
  const res = await db.functions.invoke(name, payload);
  return res.data;
};

export const aiService = {
  async analyzeSong(songData: Row) {
    return invoke("analyzeSong", songData);
  },
  async generateCampaign(input: { song: Row; analysis: Row; goals: string[]; durationDays: number; startDate: string }) {
    return invoke("generateCampaign", input);
  },
  async generateCaptions(input: { song: Row; analysis?: Row; platform?: string }) {
    return invoke("generateContent", { ...input, contentType: "caption" });
  },
};
