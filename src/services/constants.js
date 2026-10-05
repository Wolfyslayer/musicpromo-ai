/**
 * App-wide constants. Centralised so platform/genre/goal lists stay consistent
 * across the UI and the AI prompts, and are easy to extend.
 */

export const PLATFORMS = [
  { id: "TikTok", label: "TikTok", color: "#ff2d55", icon: "Music2" },
  { id: "Instagram Reels", label: "Instagram Reels", color: "#e1306c", icon: "Instagram" },
  { id: "YouTube Shorts", label: "YouTube Shorts", color: "#ff0000", icon: "Youtube" },
  { id: "Facebook", label: "Facebook", color: "#1877f2", icon: "Facebook" },
  { id: "Spotify", label: "Spotify", color: "#1db954", icon: "Disc3" },
  { id: "X", label: "X", color: "#e7e9ea", icon: "Twitter" },
];

export const GENRES = [
  "Pop", "Hip-Hop", "R&B", "Rock", "Indie", "Electronic", "Nordic Folk",
  "Lo-fi", "Ambient", "Country", "Jazz", "Classical", "Metal", "Reggae",
  "Latin", "K-Pop", "Folk", "Singer-Songwriter", "House", "Techno", "Drum & Bass",
];

export const LANGUAGES = [
  "English", "Spanish", "French", "German", "Swedish", "Norwegian",
  "Portuguese", "Italian", "Dutch", "Japanese", "Korean", "Hindi", "Arabic", "Instrumental",
];

export const CAMPAIGN_GOALS = [
  "Increase streams",
  "Increase followers",
  "Promote a new release",
  "Build artist awareness",
  "Promote an existing song",
  "Promote an album",
  "Increase social engagement",
];

export const CAMPAIGN_DURATIONS = [
  { days: 7, label: "7-Day Campaign", hint: "Quick push" },
  { days: 14, label: "14-Day Campaign", hint: "Balanced" },
  { days: 30, label: "30-Day Campaign", hint: "Sustained rollout" },
];

export const CAMPAIGN_STATUSES = [
  { id: "draft", label: "Draft", color: "muted" },
  { id: "preparing", label: "Preparing", color: "primary" },
  { id: "scheduled", label: "Scheduled", color: "chart-3" },
  { id: "active", label: "Active", color: "chart-2" },
  { id: "completed", label: "Completed", color: "chart-1" },
  { id: "archived", label: "Archived", color: "muted" },
];

export const RELEASE_TYPES = [
  { id: "single", label: "Single", hint: "One focus track" },
  { id: "ep", label: "EP", hint: "2–6 tracks" },
  { id: "album", label: "Album", hint: "Full project rollout" },
];

export const RELEASE_STATUSES = [
  { id: "draft", label: "Draft", color: "muted" },
  { id: "scheduled", label: "Scheduled", color: "chart-3" },
  { id: "released", label: "Released", color: "chart-2" },
];

export const CAMPAIGN_DAY_STATUSES = [
  { id: "planned", label: "Planned", color: "muted" },
  { id: "pending", label: "Pending", color: "muted" },
  { id: "ready", label: "Ready", color: "primary" },
  { id: "scheduled", label: "Scheduled", color: "chart-3" },
  { id: "processing", label: "Publishing", color: "primary" },
  { id: "posted", label: "Live", color: "chart-2" },
  { id: "failed", label: "Failed", color: "chart-3" },
  { id: "complete", label: "Complete", color: "chart-2" },
  { id: "skipped", label: "Skipped", color: "chart-3" },
];

export const SOCIAL_POST_STATUSES = [
  { id: "draft", label: "Draft", color: "muted" },
  { id: "scheduled", label: "Scheduled", color: "chart-3" },
  { id: "publishing", label: "Publishing", color: "primary" },
  { id: "published", label: "Live", color: "chart-2" },
  { id: "failed", label: "Failed", color: "chart-3" },
];

export const SOCIAL_CONNECTION_STATUSES = [
  { id: "not_connected", label: "Not connected", color: "muted" },
  { id: "connecting", label: "Connecting", color: "primary" },
  { id: "connected", label: "Connected", color: "chart-2" },
  { id: "connection_error", label: "Connection error", color: "chart-3" },
  { id: "unavailable", label: "Not configured", color: "muted" },
];

export const CONTENT_TYPES = [
  "Lyric Hook", "Storytelling", "Cinematic Teaser", "Artwork Reveal",
  "Behind the Scenes", "Acoustic Snippet", "Dance Challenge", "Q&A",
  "Countdown", "Release Announcement", "Waveform Visual", "Fan Reaction",
];

export const VIDEO_TEMPLATES_LIST = [
  "HOOK", "LYRICS", "CINEMATIC", "WAVEFORM", "RELEASE", "MINIMAL",
];

export const TEXT_STYLES = [
  { id: "bold", label: "Bold Sans" },
  { id: "elegant", label: "Elegant Serif" },
  { id: "mono", label: "Mono" },
  { id: "neon", label: "Neon Glow" },
];

export const ANIMATION_STYLES = [
  { id: "zoom-pan", label: "Zoom & Pan" },
  { id: "fade", label: "Fade In" },
  { id: "slide", label: "Slide Up" },
  { id: "pulse", label: "Pulse" },
  { id: "parallax", label: "Parallax" },
];

export const platformColor = (name) =>
  (PLATFORMS.find((p) => p.id === name) || {}).color || "#8b8b9a";

export const statusMeta = (id) =>
  CAMPAIGN_STATUSES.find((s) => s.id === id)
  || RELEASE_STATUSES.find((s) => s.id === id)
  || CAMPAIGN_DAY_STATUSES.find((s) => s.id === id)
  || SOCIAL_POST_STATUSES.find((s) => s.id === id)
  || SOCIAL_CONNECTION_STATUSES.find((s) => s.id === id)
  || CAMPAIGN_STATUSES[0];

/** Public support inbox (legal pages, errors, Supabase email templates). */
export const SUPPORT_EMAIL = "support@musicpromoai.site";
