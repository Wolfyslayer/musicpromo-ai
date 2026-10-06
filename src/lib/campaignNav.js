import {
  BarChart3,
  Film,
  LayoutGrid,
  ListChecks,
  Sparkles,
} from "lucide-react";

/** Primary strip — matches the 4 tabs in the campaign mobile screenshot */
export const CAMPAIGN_PRIMARY_TABS = [
  { segment: "plan", label: "Plan", shortLabel: "Plan", icon: ListChecks },
  { segment: "library", label: "Hooks & captions", shortLabel: "Copy", icon: Sparkles },
  { segment: "videos", label: "Promo videos", shortLabel: "Videos", icon: Film },
  { segment: "analytics", label: "Analytics", shortLabel: "Analytics", icon: BarChart3 },
];

export const CAMPAIGN_EXTRA_SECTIONS = [
  { segment: "content", label: "Content workspace", shortLabel: "Workspace", icon: LayoutGrid },
];

export const CAMPAIGN_SECTIONS = [...CAMPAIGN_PRIMARY_TABS, ...CAMPAIGN_EXTRA_SECTIONS];

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
