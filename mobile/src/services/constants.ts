export const CAMPAIGN_STATUSES = [
  { id: "draft", label: "Draft", color: "muted" },
  { id: "preparing", label: "Preparing", color: "primary" },
  { id: "scheduled", label: "Scheduled", color: "chart3" },
  { id: "active", label: "Active", color: "chart2" },
  { id: "completed", label: "Completed", color: "chart1" },
  { id: "archived", label: "Archived", color: "muted" },
] as const;

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

export const GENRES = [
  "Pop",
  "Hip-Hop",
  "R&B",
  "Rock",
  "Indie",
  "Electronic",
  "Lo-fi",
  "Ambient",
  "Country",
  "Jazz",
  "Folk",
  "House",
];
