import {
  BarChart3,
  Film,
  LayoutGrid,
  ListChecks,
  Mic2,
  Sparkles,
} from "lucide-react";

/** Nested routes under `/campaigns/:id/*` */
export const CAMPAIGN_SECTIONS = [
  { segment: "plan", label: "Plan", shortLabel: "Plan", icon: ListChecks },
  { segment: "library", label: "AI content", shortLabel: "Content", icon: Sparkles },
  { segment: "content", label: "Content workspace", shortLabel: "Workspace", icon: LayoutGrid },
  { segment: "videos", label: "Videos", shortLabel: "Videos", icon: Film },
  { segment: "analytics", label: "Analytics", shortLabel: "Stats", icon: BarChart3 },
  { segment: "song", label: "Song analysis", shortLabel: "Song", icon: Mic2 },
];

/** Legacy `?tab=` query on `/campaigns/:id` */
export const LEGACY_CAMPAIGN_TAB_PATH = {
  plan: "plan",
  content: "library",
  videos: "videos",
  analytics: "analytics",
};

export function campaignSectionPath(campaignId, segment) {
  return `/campaigns/${campaignId}/${segment}`;
}
