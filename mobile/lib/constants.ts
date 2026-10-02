export const PLATFORMS = [
  { id: "TikTok", label: "TikTok", color: "#ff2d55" },
  { id: "Instagram Reels", label: "Instagram Reels", color: "#e1306c" },
  { id: "YouTube Shorts", label: "YouTube Shorts", color: "#ff0000" },
  { id: "Facebook", label: "Facebook", color: "#1877f2" },
  { id: "Spotify", label: "Spotify", color: "#1db954" },
  { id: "X", label: "X", color: "#e7e9ea" },
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
  { id: "draft", label: "Draft" },
  { id: "preparing", label: "Preparing" },
  { id: "scheduled", label: "Scheduled" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
];

export const RELEASE_STATUSES = [
  { id: "draft", label: "Draft" },
  { id: "scheduled", label: "Scheduled" },
  { id: "released", label: "Released" },
];

export const CAMPAIGN_DAY_STATUSES = [
  { id: "planned", label: "Planned" },
  { id: "pending", label: "Pending" },
  { id: "ready", label: "Ready" },
  { id: "scheduled", label: "Scheduled" },
  { id: "processing", label: "Publishing" },
  { id: "posted", label: "Live" },
  { id: "failed", label: "Failed" },
  { id: "complete", label: "Complete" },
  { id: "skipped", label: "Skipped" },
];

export const CONTENT_TYPES = [
  "Lyric Hook", "Storytelling", "Cinematic Teaser", "Artwork Reveal",
  "Behind the Scenes", "Acoustic Snippet", "Dance Challenge", "Q&A",
  "Countdown", "Release Announcement", "Waveform Visual", "Fan Reaction",
];

export const VIDEO_TEMPLATES_LIST = ["HOOK", "LYRICS", "CINEMATIC", "WAVEFORM", "RELEASE", "MINIMAL"];

export const statusMeta = (id?: string) =>
  CAMPAIGN_STATUSES.find((s) => s.id === id)
  || RELEASE_STATUSES.find((s) => s.id === id)
  || CAMPAIGN_DAY_STATUSES.find((s) => s.id === id)
  || { id: id || "draft", label: id || "Draft" };
