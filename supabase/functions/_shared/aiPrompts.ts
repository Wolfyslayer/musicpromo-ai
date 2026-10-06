/**
 * AI prompt templates — the single source of truth for all LLM prompts.
 * Kept separate from UI code so they can be tuned, versioned, or swapped
 * for an external service without touching the interface.
 *
 * Each builder returns { prompt, schema } where `schema` is the JSON schema
 * passed to the LLM (response_json_schema).
 *
 * Provider note: the backend functions route these prompts through the
 * Base44 InvokeLLM integration. To port off Base44, point the same functions
 * at any OpenAI-compatible endpoint — only the function bodies change.
 */

const SONG_SUMMARY = (song) => {
  const parts = [
    `Title: ${song.title || "Untitled"}`,
    `Artist: ${song.artistName || song.artist_name || "Unknown artist"}`,
    `Genre: ${song.genre || "Unspecified"}`,
    `Language: ${song.language || "Unspecified"}`,
    `Release date: ${song.release_date || "Not set"}`,
  ];
  if (song.release_title || song.releaseTitle) {
    parts.push(`Release: ${song.release_title || song.releaseTitle}`);
  }
  if (song.release_type || song.releaseType) {
    parts.push(`Release type: ${song.release_type || song.releaseType}`);
  }
  if (Array.isArray(song.tracks) && song.tracks.length > 1) {
    const list = song.tracks
      .map((t) => String(t?.title || "Untitled").trim())
      .filter(Boolean)
      .join(", ");
    parts.push(`Tracklist (${song.tracks.length} tracks): ${list}`);
  }
  if (song.assetProfile?.label) {
    parts.push(`On-device visual read (from artwork colors): ${song.assetProfile.label}`);
  }
  if (song.description) parts.push(`Description: ${song.description}`);
  if (song.lyrics && song.lyrics.trim()) {
    parts.push(`Lyrics:\n${song.lyrics.slice(0, 4000)}`);
  } else {
    parts.push("Lyrics: (not provided)");
  }
  return parts.join("\n");
};

const GUARDRAILS = `CONSTRAINTS
- Ground every output ONLY in the information provided. Do not invent biographical facts about the artist.
- Never claim any guaranteed audience size, streams, views, followers, or results.
- Where information is missing, make a reasonable, clearly-hedged inference and keep it general.
- Use cautious language ("may", "could", "tends to"). Never promise virality.`;

function resolveSongLanguage(song: { language?: string } | null | undefined): string {
  const raw = String(song?.language || "").trim();
  return raw || "English";
}

/** Mandatory copy language for hooks, captions, CTAs, hashtags, and campaign day text. */
function buildLanguageOutputRule(song: { language?: string; description?: string } | null | undefined): string {
  const lang = resolveSongLanguage(song);
  if (lang.toLowerCase() === "instrumental") {
    return `OUTPUT LANGUAGE (mandatory)
- The track is instrumental (no vocals). Do not invent lyrics.
- Write ALL hooks, captions, CTAs, objectives, videoConcept lines, and hashtag words in English unless the song description is clearly written in another language — then match that language.
- Keep platform names (TikTok, Instagram, YouTube) as proper nouns.`;
  }
  return `OUTPUT LANGUAGE (mandatory)
- The song language setting is "${lang}". Write ALL promotional copy (hooks, captions, CTAs, objectives, videoConcept descriptions, campaign summary lines meant for the artist, and hashtag words) in ${lang}.
- Do not default to English when ${lang} is not English.
- You may keep platform names and @handles in their original form.
- When quoting lyrics verbatim, keep quotes in the lyric language; all non-quote promo copy must still be ${lang}.`;
}

// ---------------------------------------------------------------------------
// 1. SONG ANALYSIS
// ---------------------------------------------------------------------------
export function buildAnalyzeSongPrompt(song) {
  const prompt = `You are a senior music marketing A&R analyst. Analyze the following song and release information and return a structured analysis that an independent artist can use to promote it.

${SONG_SUMMARY(song)}

${buildLanguageOutputRule(song)}

${GUARDRAILS}

Return JSON with these fields:
- genre: best-fit primary genre label
- subgenre: a more specific subgenre label
- mood: a short phrase (1-3 descriptors) describing the mood
- energy: a short descriptor of energy/intensity (e.g. "Slow build", "High energy")
- emotionalTone: a short phrase describing the emotional tone
- themes: array of 3-6 lyrical/conceptual themes
- lyricalThemes: array of 3-5 themes specifically drawn from the lyrics (if lyrics are not provided, infer from title and description and keep general)
- audienceThemes: array of 3-5 themes that describe the target listener's mindset or lifestyle
- musicalCharacteristics: array of 3-6 likely musical characteristics
- targetAudiences: array of 2-4 described audience segments (no audience-size claims)
- promotionalAngles: array of 3-5 distinct angles to build content around
- contentOpportunities: array of at least 8 objects, each { type, title, description } where type is one of: "emotional_hook", "lyric_hook", "storytelling", "question", "controversial_lyric", "cinematic_concept", "behind_the_song", "release_announcement" (or another descriptive type). Each must be specific to THIS song.
- hookSections: array of 2-4 likely strong hook moments (lyric lines or sections) if lyrics are available; otherwise general suggestions
- recommendedPlatforms: array of platforms from this set only: TikTok, Instagram Reels, YouTube Shorts, Facebook, Spotify, X
- recommendedFormats: array of 3-6 content formats (e.g. "Lyric video", "Cinematic teaser", "Behind-the-scenes")
- recommendedVisualStyle: one of pop, hiphop, rock, electronic, rnb, cinematic — best default Remotion typography/motion for this song
- recommendedParticleEffect: one of none, stardust, smoke, sparks, leaks, vhs, neon, vinyl, rings, shake, prism, fluid, grain — best overlay for short promo clips`;

  const schema = {
    type: "object",
    properties: {
      genre: { type: "string" },
      subgenre: { type: "string" },
      mood: { type: "string" },
      energy: { type: "string" },
      emotionalTone: { type: "string" },
      themes: { type: "array", items: { type: "string" } },
      lyricalThemes: { type: "array", items: { type: "string" } },
      audienceThemes: { type: "array", items: { type: "string" } },
      musicalCharacteristics: { type: "array", items: { type: "string" } },
      targetAudiences: { type: "array", items: { type: "string" } },
      promotionalAngles: { type: "array", items: { type: "string" } },
      contentOpportunities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["type", "title", "description"],
        },
      },
      hookSections: { type: "array", items: { type: "string" } },
      recommendedPlatforms: { type: "array", items: { type: "string" } },
      recommendedFormats: { type: "array", items: { type: "string" } },
      recommendedVisualStyle: { type: "string" },
      recommendedParticleEffect: { type: "string" },
    },
    required: ["genre", "mood", "themes", "contentOpportunities", "recommendedPlatforms"],
  };
  return { prompt, schema };
}

// ---------------------------------------------------------------------------
// 2. PROMOTIONAL HOOKS
// ---------------------------------------------------------------------------
export function buildGenerateHooksPrompt({ song, analysis, platform }) {
  const prompt = `You are a short-form video hook writer for music promotion. Generate at least 10 short hooks suitable for the first 1-3 seconds of a ${platform || "TikTok"} / Reel / Short.

${SONG_SUMMARY(song)}

${buildLanguageOutputRule(song)}

ANALYSIS
${JSON.stringify(analysis || {}, null, 2)}

${GUARDRAILS}

- Each hook must be specific to THIS song — not generic music marketing phrases.
- Keep hooks short, natural and punchy (under 15 words).
- Vary the approach: some curiosity-driven, some emotional, some bold/lyrical.
- videoConcept should recommend a video template from: HOOK, LYRICS, CINEMATIC, WAVEFORM, RELEASE, MINIMAL.

Return JSON: { hooks: array of { text, platform, videoConcept, reason } }`;

  const schema = {
    type: "object",
    properties: {
      hooks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            platform: { type: "string" },
            videoConcept: { type: "string" },
            reason: { type: "string" },
          },
          required: ["text", "platform", "videoConcept", "reason"],
        },
      },
    },
    required: ["hooks"],
  };
  return { prompt, schema };
}

// ---------------------------------------------------------------------------
// 3. CAPTION GENERATOR
// ---------------------------------------------------------------------------
export function buildGenerateCaptionsPrompt({ song, analysis, platform }) {
  const prompt = `You are a short-form music content writer. Generate 3 caption variations for ${platform || "TikTok"} based on this song.

${SONG_SUMMARY(song)}

${buildLanguageOutputRule(song)}

ANALYSIS
${JSON.stringify(analysis || {}, null, 2)}

${GUARDRAILS}

Produce exactly 3 captions for the platform "${platform}":
1. "short" — concise and punchy
2. "emotional" — story/emotion-focused
3. "engagement" — designed to invite comments and shares

Each caption must be specific to THIS song. Avoid generic AI-sounding phrases.

Return JSON: { captions: array of { variation, text } }`;

  const schema = {
    type: "object",
    properties: {
      captions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            variation: { type: "string" },
            text: { type: "string" },
          },
          required: ["variation", "text"],
        },
      },
    },
    required: ["captions"],
  };
  return { prompt, schema };
}

// ---------------------------------------------------------------------------
// 4. HASHTAG GENERATOR
// ---------------------------------------------------------------------------
export function buildGenerateHashtagsPrompt({ song, analysis, platform }) {
  const prompt = `You are a music social-media strategist. Generate relevant hashtags for ${platform || "TikTok"} promotion of this song.

${SONG_SUMMARY(song)}

${buildLanguageOutputRule(song)}

ANALYSIS
${JSON.stringify(analysis || {}, null, 2)}

${GUARDRAILS}

- Separate hashtags into categories: genre, theme, music_discovery, artist_song, platform_specific.
- Keep each category to 3-6 relevant tags. Avoid spam hashtags (e.g. #fyp, #viral) unless platform_specific.
- Tags should be specific to the song, genre and themes — not generic.

Return JSON: { categories: array of { category, tags: [string] } }`;

  const schema = {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["category", "tags"],
        },
      },
    },
    required: ["categories"],
  };
  return { prompt, schema };
}

// ---------------------------------------------------------------------------
// 5. CALL-TO-ACTION GENERATOR
// ---------------------------------------------------------------------------
export function buildGenerateCTAPrompt({ song, analysis, campaignGoals }) {
  const prompt = `You are a music marketing copywriter. Generate relevant calls-to-action for promoting this song.

${SONG_SUMMARY(song)}

${buildLanguageOutputRule(song)}

ANALYSIS
${JSON.stringify(analysis || {}, null, 2)}

CAMPAIGN GOALS
${(campaignGoals && campaignGoals.length ? campaignGoals : ["Promote a new release"]).join(", ")}

${GUARDRAILS}

- Generate 4-6 CTAs aligned with the campaign goals.
- Examples of types: listen to the full song, follow the artist, save the track, share the song, comment your interpretation, add to a playlist.
- Each CTA must be specific and natural. Never claim any CTA guarantees results.
- Return JSON: { ctas: array of { text, goal } }`;

  const schema = {
    type: "object",
    properties: {
      ctas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            goal: { type: "string" },
          },
          required: ["text", "goal"],
        },
      },
    },
    required: ["ctas"],
  };
  return { prompt, schema };
}

// ---------------------------------------------------------------------------
// 6. VIDEO CONCEPTS
// ---------------------------------------------------------------------------
export function buildGenerateVideoConceptsPrompt({ song, analysis }) {
  const prompt = `You are a music video creative director. Generate promotional video concepts for this song.

${SONG_SUMMARY(song)}

${buildLanguageOutputRule(song)}

ANALYSIS
${JSON.stringify(analysis || {}, null, 2)}

${GUARDRAILS}

- Generate at least 6 distinct video concepts based on the song's actual themes, lyrics and mood.
- Each concept must recommend a template from: HOOK, LYRICS, CINEMATIC, WAVEFORM, RELEASE, MINIMAL.
- Include a suggested hook text and a duration (5-30 seconds).
- Concepts must be specific to THIS song, not generic.

Return JSON: { concepts: array of { title, conceptType, description, template, hookText, duration } }`;

  const schema = {
    type: "object",
    properties: {
      concepts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            conceptType: { type: "string" },
            description: { type: "string" },
            template: { type: "string" },
            hookText: { type: "string" },
            duration: { type: "number" },
          },
          required: ["title", "conceptType", "description", "template", "hookText", "duration"],
        },
      },
    },
    required: ["concepts"],
  };
  return { prompt, schema };
}

// ---------------------------------------------------------------------------
// 7. BEST PROMOTIONAL MOMENT (estimated — no real audio analysis)
// ---------------------------------------------------------------------------
export function buildAnalyzePromotionalMomentPrompt({ song, analysis }) {
  const prompt = `You are a music production analyst. Estimate the most promotable moment of this song for short-form video.

${SONG_SUMMARY(song)}

${buildLanguageOutputRule(song)}

ANALYSIS
${JSON.stringify(analysis || {}, null, 2)}

${GUARDRAILS}

IMPORTANT: You do NOT have access to the actual audio file or waveform. You must base your estimate ONLY on the lyrics, structure and description provided. This is an ESTIMATE, not a real audio analysis.

- If lyrics are available, estimate a moment based on a strong lyrical/emotional section (e.g. a chorus or standout line). Provide approximate start/end times in mm:ss format.
- If lyrics are NOT available, return a general recommendation with null timestamps and explain that timestamps require real audio analysis.
- Clearly state this is estimated.

Return JSON: { startTime, endTime, reason, suggestedContentType, isEstimated: true }`;

  const schema = {
    type: "object",
    properties: {
      startTime: { type: ["string", "null"] },
      endTime: { type: ["string", "null"] },
      reason: { type: "string" },
      suggestedContentType: { type: "string" },
      isEstimated: { type: "boolean" },
    },
    required: ["reason", "suggestedContentType", "isEstimated"],
  };
  return { prompt, schema };
}

// ---------------------------------------------------------------------------
// 8. CAMPAIGN GENERATOR
// ---------------------------------------------------------------------------
export function buildGenerateCampaignPrompt(input) {
  const { song, analysis, goals, durationDays, startDate, releaseDate, promoStyle } = input;
  const platforms = (analysis?.recommendedPlatforms && analysis.recommendedPlatforms.length)
    ? analysis.recommendedPlatforms
    : ["TikTok", "Instagram Reels", "YouTube Shorts"];
  const styleHint = promoStyle
    ? `CREATOR'S PROMO LOOK (use as the default visual language; vary per day where the platform benefits)
- Preset: ${promoStyle.presetId || "custom"}
- visualStyle: ${promoStyle.visualStyle || "pop"} (pop | hiphop | rock | electronic | rnb | cinematic)
- particleEffect: ${promoStyle.particleEffect || "none"} (none | stardust | smoke | sparks | leaks | vhs | neon | vinyl | rings | shake | prism | fluid | grain)
- preferred template family: ${promoStyle.defaultTemplate || "HOOK"}`
    : `Use analysis.recommendedVisualStyle and recommendedParticleEffect when present; otherwise infer from genre/mood.`;

  const prompt = `You are an expert social-media music marketing strategist. Design a ${durationDays}-day promotional campaign for a song.

${SONG_SUMMARY(song)}

${buildLanguageOutputRule(song)}

ANALYSIS (use this as your strategic foundation)
${JSON.stringify(analysis || {}, null, 2)}

CAMPAIGN GOALS
${(goals && goals.length ? goals : ["Promote a new release"]).join(", ")}

CAMPAIGN START DATE
${startDate || "today"}
${releaseDate ? `\nRELEASE DATE (final plan day must land on this date)\n${releaseDate}\n- Days 1 through ${Number(durationDays) - 1 || 0}: pre-release teasers, countdown, BTS, snippets — use HOOK, CINEMATIC, LYRICS, WAVEFORM, MINIMAL.\n- Day ${durationDays} (release date): release announcement — videoTemplate MUST be RELEASE, contentType release_announcement, hook celebrates the drop.\n` : ""}

${styleHint}

${GUARDRAILS}

- Produce exactly ${durationDays} daily entries. Day numbers run from 1 to ${durationDays}. Day 1 is the campaign start date (${startDate || "today"}); compute each subsequent date by adding one day.
- Spread content across these platforms only: ${platforms.join(", ")}. Vary the platform and content type across days.
- Make every hook, caption, hashtag set and CTA specific to THIS song and analysis — not generic templates.
- Hooks must work as on-screen promo text (under 12 words, no hashtags).
- videoConcept: one vivid sentence describing camera/motion for a 9:16 Remotion promo (artwork zoom, lyric beat, etc.) — no stock-footage assumptions.
- Hashtags: 5-10 per day, relevant to the artist, genre, song theme and platform. Avoid spam hashtags.
- videoTemplate: one of HOOK, LYRICS, CINEMATIC, WAVEFORM, RELEASE, MINIMAL per day — match the day's content goal.
- visualStyle & particleEffect: Remotion render settings per day (see allowed values above). Usually stay close to the creator look; shift for platform (e.g. faster hooks on TikTok).
- promoDurationSec: 15 or 30 — short-form length for that day's video.
- postingTime: a local time string like "18:30".

Return JSON with:
- campaignName: a short evocative campaign name
- summary: 2-3 sentence strategy summary (cautious, no guarantees)
- days: array of ${durationDays} objects, each with fields:
  dayNumber (number), date (YYYY-MM-DD), platform (string), contentType (string), objective (string), videoConcept (string), hook (string), caption (string), hashtags (string, space-separated), cta (string), videoTemplate (string), visualStyle (string), particleEffect (string), promoDurationSec (number), postingTime (string)`;

  const schema = {
    type: "object",
    properties: {
      campaignName: { type: "string" },
      summary: { type: "string" },
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dayNumber: { type: "number" },
            date: { type: "string" },
            platform: { type: "string" },
            contentType: { type: "string" },
            objective: { type: "string" },
            videoConcept: { type: "string" },
            hook: { type: "string" },
            caption: { type: "string" },
            hashtags: { type: "string" },
            cta: { type: "string" },
            videoTemplate: { type: "string" },
            visualStyle: { type: "string" },
            particleEffect: { type: "string" },
            promoDurationSec: { type: "number" },
            postingTime: { type: "string" },
          },
          required: ["dayNumber", "platform", "contentType", "caption", "hashtags", "cta", "hook", "videoConcept", "videoTemplate"],
        },
      },
    },
    required: ["campaignName", "summary", "days"],
  };
  return { prompt, schema };
}

// ---------------------------------------------------------------------------
// 9. CAMPAIGN PERFORMANCE ANALYSIS
// ---------------------------------------------------------------------------
export function buildAnalyzePerformancePrompt(input) {
  const { campaign, days, analytics } = input;
  const prompt = `You are a music marketing analyst. Review the performance data entered for a campaign and identify patterns and cautious, actionable suggestions. Do NOT claim any strategy will definitely produce results. Use hedged language like "tended to", "received more", "may be worth".

CAMPAIGN
${JSON.stringify({ name: campaign?.name, goals: campaign?.goals, durationDays: campaign?.duration_days, status: campaign?.status }, null, 2)}

CAMPAIGN DAYS (content plan)
${JSON.stringify((days || []).map((d) => ({ day: d.day_number, platform: d.platform, contentType: d.content_type, status: d.status })), null, 2)}

ANALYTICS ENTRIES
${JSON.stringify((analytics || []).map((a) => ({ platform: a.platform, contentType: a.content_type, date: a.date, views: a.views, likes: a.likes, comments: a.comments, shares: a.shares, saves: a.saves, followersGained: a.followers_gained, streams: a.streams, playlistAdds: a.playlist_adds, clicks: a.clicks })), null, 2)}

Return JSON with:
- summary: 2-3 sentence overview (cautious)
- insights: array of { title, description, type } where type is "positive" | "neutral" | "caution"
- recommendations: array of 3-6 specific, cautious suggestions for future content`;

  const schema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      insights: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, description: { type: "string" }, type: { type: "string" } },
          required: ["title", "description", "type"],
        },
      },
      recommendations: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "insights", "recommendations"],
  };
  return { prompt, schema };
}

// ---------------------------------------------------------------------------
// ROUTER — maps a contentType to the right prompt builder.
// Used by the generateContent backend function so one endpoint serves all
// content types while keeping prompts modular and individually tunable.
// ---------------------------------------------------------------------------
export function buildContentPrompt(input) {
  const { contentType } = input;
  switch (contentType) {
    case "hook": return buildGenerateHooksPrompt(input);
    case "caption": return buildGenerateCaptionsPrompt(input);
    case "hashtags": return buildGenerateHashtagsPrompt(input);
    case "cta": return buildGenerateCTAPrompt(input);
    case "video_concept": return buildGenerateVideoConceptsPrompt(input);
    case "promotional_moment": return buildAnalyzePromotionalMomentPrompt(input);
    default:
      throw new Error(`Unknown contentType: ${contentType}`);
  }
}