import {
  buildLyricCues,
  clampAudioOffset,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVideoType,
  normalizeVisualStyle,
  resolveStudioDuration,
  scaleLyricCues,
} from "@/services/promoStyles";

export const CAMPAIGN_PRESETS = [
  {
    id: "teaser",
    label: "Teaser Short",
    seconds: 15,
    blurb: "Stories and Shorts",
    look: { fontSize: 52, letterSpacing: -0.4, lyricY: 76, animationMs: 180, particleSpeed: 0.72 },
  },
  {
    id: "promo",
    label: "Full Promo",
    seconds: 30,
    blurb: "Reels tracking",
    look: { fontSize: 64, letterSpacing: 1.4, lyricY: 82, animationMs: 280, particleSpeed: 0.5 },
  },
  {
    id: "hype",
    label: "Extended Hype",
    seconds: 60,
    blurb: "Full particle length",
    look: { fontSize: 72, letterSpacing: 2, lyricY: 84, animationMs: 360, particleSpeed: 0.92 },
  },
];

export const isHttpsUrl = (url) => /^https:\/\//i.test(String(url || ""));

export function savedVideoType(project) {
  return normalizeVideoType(project?.animation_settings?.videoType || project?.video_type);
}

export function studioDuration(project, audioSeconds) {
  return resolveStudioDuration(project?.video_type, project?.duration, audioSeconds);
}

export function studioCues(project, audioSeconds) {
  return buildLyricCues(project?.lyrics, studioDuration(project, audioSeconds), project?.lyric_cues);
}

/** Cues for the editable list: normalised timings, but raw text so blank or trailing-space edits survive typing. */
export function editableCues(project, audioSeconds) {
  const duration = studioDuration(project, audioSeconds);
  const raw = project?.lyric_cues;
  if (!Array.isArray(raw) || !raw.length) return buildLyricCues(project?.lyrics, duration, []);
  return raw.map((cue) => {
    const [timed] = buildLyricCues("", duration, [{ ...cue, text: "-" }]);
    return { ...timed, text: String(cue?.text ?? "") };
  });
}

/** Same project shape the web studio builds from the campaign, the saved project, or a campaign day. */
export function buildInitialProject({ data, savedProject, day, campaignId, videoType, requestedSeconds, requestedText }) {
  const song = data?.song || null;
  const profile = song?.analysis?.assetProfile || null;
  const audioSeconds = Number(song?.audio_duration) || 0;
  const promo = videoType === "promo";
  const duration = resolveStudioDuration(
    videoType,
    promo ? savedProject?.duration || requestedSeconds : savedProject?.duration || audioSeconds,
    audioSeconds
  );
  let base = {
    template: profile?.template || "LYRICS",
    title: song?.title || "",
    artist_name: data?.artist?.name || "",
    text: promo ? day?.hook || requestedText || profile?.hooks?.[0] || "" : "",
    outro_cta: promo ? day?.cta || "Listen now" : "",
    artwork_url: song?.artwork_url || "",
    audio_url: song?.audio_url || "",
    audio_duration: audioSeconds,
    lyrics: song?.lyrics || "",
    visual_style: normalizeVisualStyle(profile?.visualStyle || "pop"),
    particle_effect: normalizeParticleEffect(profile?.particleEffect || "none"),
    editor_look: normalizeEditorLook(null),
    lyric_cues: buildLyricCues(song?.lyrics || "", duration, []),
    duration,
    video_type: videoType,
    asset_label: profile?.label || "",
    asset_keywords: profile?.keywords || [],
    asset_hooks: profile?.hooks || [],
    song_id: song?.id,
    campaign_id: campaignId || savedProject?.campaign_id || null,
    animation_settings: {
      videoType,
      outroCta: promo ? day?.cta || "Listen now" : "",
      keywords: profile?.keywords || [],
      hooks: profile?.hooks || [],
      label: profile?.label || "",
    },
  };
  if (savedProject) {
    const savedDuration = resolveStudioDuration(videoType, savedProject.duration || duration, audioSeconds);
    base = {
      ...base,
      ...savedProject,
      video_type: videoType,
      outro_cta: savedProject.animation_settings?.outroCta || base.outro_cta,
      visual_style: normalizeVisualStyle(savedProject.visual_style || base.visual_style),
      particle_effect: normalizeParticleEffect(savedProject.particle_effect || base.particle_effect),
      editor_look: normalizeEditorLook(savedProject.editor_look || base.editor_look),
      duration: savedDuration,
      lyric_cues: buildLyricCues(savedProject.lyrics || base.lyrics, savedDuration, savedProject.lyric_cues),
    };
  } else if (day) {
    base = {
      ...base,
      title: song?.title || "",
      text: promo ? day.hook || day.caption || base.text : "",
      outro_cta: promo ? day.cta || base.outro_cta : "",
    };
  }
  return base;
}

function packVideoProject(project, audioSeconds) {
  const videoType = normalizeVideoType(project?.video_type || project?.animation_settings?.videoType);
  const duration = resolveStudioDuration(videoType, project?.duration, audioSeconds);
  const {
    video_type: _videoType,
    outro_cta: outroCta,
    asset_keywords: keywords,
    asset_hooks: hooks,
    asset_label: label,
    ...rest
  } = project || {};
  return {
    ...rest,
    duration,
    lyric_cues: buildLyricCues(project?.lyrics, duration, project?.lyric_cues),
    animation_settings: {
      ...(project?.animation_settings || {}),
      videoType,
      outroCta: outroCta || project?.animation_settings?.outroCta || "",
      keywords: keywords || project?.animation_settings?.keywords || [],
      hooks: hooks || project?.animation_settings?.hooks || [],
      label: label || project?.animation_settings?.label || "",
    },
  };
}

/** Payload the web studio's "Save Project" writes through saveVideoProject. */
export function buildSavePayload(project, audioSeconds, userId) {
  const packed = packVideoProject(project, audioSeconds);
  return {
    ...packed,
    ...(audioSeconds > 0 ? { audio_duration: audioSeconds } : null),
    visual_style: normalizeVisualStyle(project.visual_style),
    particle_effect: normalizeParticleEffect(project.particle_effect),
    editor_look: normalizeEditorLook(project.editor_look),
    audioStartTimeOffset: clampAudioOffset(project.audioStartTimeOffset, audioSeconds, packed.duration),
    user_id: project.user_id || userId || "",
    is_demo: false,
  };
}

export function applyPreset(project, preset, audioSeconds) {
  if (project.video_type === "lyrics") return project;
  const from = studioDuration(project, audioSeconds);
  const nextDuration = resolveStudioDuration(project.video_type, preset.seconds, audioSeconds);
  const cues = buildLyricCues(project.lyrics, from, project.lyric_cues);
  return {
    ...project,
    duration: nextDuration,
    editor_look: normalizeEditorLook({ ...normalizeEditorLook(project.editor_look), ...preset.look }),
    lyric_cues: scaleLyricCues(cues, from, nextDuration),
  };
}

export function styleFingerprint(p) {
  if (!p) return "";
  return [
    p.visual_style,
    p.particle_effect,
    p.duration,
    JSON.stringify(normalizeEditorLook(p.editor_look)),
    p.audioStartTimeOffset || 0,
    p.title,
    p.artist_name,
    p.text,
    JSON.stringify(p.lyric_cues || []).slice(0, 400),
    (p.lyrics || "").slice(0, 200),
  ].join("|");
}

export function webStudioUrl({ campaignId, projectId, videoType, duration }) {
  const base = String(process.env.EXPO_PUBLIC_WEB_APP_URL || "").replace(/\/+$/, "");
  if (!base) return "";
  if (!campaignId) return `${base}/studio`;
  if (projectId) return `${base}/campaigns/${campaignId}/video?project=${projectId}`;
  const query = videoType === "promo" ? `videoType=promo&seconds=${duration === 30 ? 30 : 15}` : `videoType=${videoType || "lyrics"}`;
  return `${base}/campaigns/${campaignId}/video?${query}`;
}
