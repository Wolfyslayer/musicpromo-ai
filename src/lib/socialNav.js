import { Activity, Clock, Link2, Share2 } from "lucide-react";

export const SOCIAL_SECTIONS = [
  { segment: "connect", label: "Connect accounts", shortLabel: "Connect", icon: Link2 },
  { segment: "health", label: "Command center", shortLabel: "Health", icon: Activity },
  { segment: "queue", label: "Drafts & scheduled", shortLabel: "Queue", icon: Clock },
  { segment: "activity", label: "Recent posts", shortLabel: "Activity", icon: Share2 },
];
