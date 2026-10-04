import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReleaseChecklist({
  release,
  campaigns = [],
  entries = [],
  connectedCount = 0,
  readyVideosCount = 0,
}) {
  const hasArt = Boolean(release?.artwork_url);
  const hasCampaign = campaigns.length > 0;
  const hasDays = entries.length > 0;
  const hasVideo = readyVideosCount > 0;
  const hasSocial = connectedCount > 0;

  const items = [
    {
      id: "art",
      label: "Release artwork",
      done: hasArt,
      href: release?.id ? `/releases/${release.id}/edit` : null,
    },
    {
      id: "plan",
      label: "Campaign plan days",
      done: hasDays,
      href: campaigns[0] ? `/campaigns/${campaigns[0].id}/plan` : "/create",
    },
    {
      id: "video",
      label: "Promo video ready",
      done: hasVideo,
      href: campaigns[0] ? `/campaigns/${campaigns[0].id}/video` : "/studio",
    },
    {
      id: "social",
      label: "Social platform connected",
      done: hasSocial,
      href: "/social/connect",
    },
    {
      id: "campaign",
      label: "Active campaign",
      done: hasCampaign,
      href: "/create",
    },
  ];

  const done = items.filter((i) => i.done).length;

  return (
    <div data-tour="launch-checklist" className="rounded-2xl border border-border/50 bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-heading text-sm font-600">Release checklist</p>
        <span className="text-xs text-muted-foreground">
          {done}/{items.length} complete
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              {item.label}
            </span>
            {!item.done && item.href ? (
              <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" asChild>
                <Link to={item.href}>Fix</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
