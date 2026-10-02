import { db } from '@/api/db';

/**
 * AI service interface for the frontend.
 *
 * Single entry point for all AI generation. Each function maps to a backend
 * function (which routes to InvokeLLM). To port off Base44, replace the
 * `invoke` bodies with calls to your own API — the function signatures and
 * return shapes stay the same, so UI code does not change.
 *
 * Content generation is routed through the `generateContent` backend function
 * by `contentType`. Each function here is a thin, clearly-named wrapper so the
 * UI never references content types directly.
 */

const invoke = async (name, payload) => {
  const res = await db.functions.invoke(name, payload);
  return res.data;
};

const content = (contentType, { song, analysis, platform, campaignGoals }) =>
  invoke("generateContent", { song, analysis, platform, contentType, campaignGoals });

export const aiService = {
  /** 1. Analyze a song + release info. Returns the full song profile + content opportunities. */
  async analyzeSong(songData) {
    return invoke("analyzeSong", songData);
  },

  /** 2. Generate ≥10 promotional hooks for a platform. Returns { hooks: [{text, platform, videoConcept, reason}] }. */
  async generateHooks({ song, analysis, platform }) {
    return content("hook", { song, analysis, platform });
  },

  /** 3. Generate 3 caption variations (short/emotional/engagement) for a platform. */
  async generateCaptions({ song, analysis, platform }) {
    return content("caption", { song, analysis, platform });
  },

  /** 4. Generate categorized hashtags. Returns { categories: [{category, tags}] }. */
  async generateHashtags({ song, analysis, platform }) {
    return content("hashtags", { song, analysis, platform });
  },

  /** 5. Generate CTAs based on campaign goals. Returns { ctas: [{text, goal}] }. */
  async generateCTA({ song, analysis, campaignGoals }) {
    return content("cta", { song, analysis, campaignGoals });
  },

  /** 6. Generate ≥6 video concepts. Returns { concepts: [{title, conceptType, description, template, hookText, duration}] }. */
  async generateVideoConcepts({ song, analysis }) {
    return content("video_concept", { song, analysis });
  },

  /** 7. Estimate the best promotional moment (clearly marked estimated — no real audio analysis). */
  async analyzePromotionalMoment({ song, analysis }) {
    return content("promotional_moment", { song, analysis });
  },

  /** 8. Generate a day-by-day campaign. Returns { campaignName, summary, days[] }. */
  async generateCampaign({ song, analysis, goals, durationDays, startDate }) {
    return invoke("generateCampaign", { song, analysis, goals, durationDays, startDate });
  },

  /** 9. Analyze entered performance data. Returns { summary, insights[], recommendations[] }. */
  async analyzeCampaignPerformance({ campaign, days, analytics }) {
    return invoke("analyzeCampaignPerformance", { campaign, days, analytics });
  },
};

export default aiService;
