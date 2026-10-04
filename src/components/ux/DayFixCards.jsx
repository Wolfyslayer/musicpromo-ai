import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { primaryProviderForDayPlatform } from "@/services/social/dayPlatform";

export default function DayFixCards({ day, campaign, onOpenCompose }) {
  if (!day) return null;
  const fixes = [];
  const err = String(day.publish_error || "").toLowerCase();
  const provider = primaryProviderForDayPlatform(day.platform);

  if (!String(day.caption || "").trim()) {
    fixes.push({
      key: "caption",
      title: "Add caption",
      detail: "Empty captions underperform when you publish.",
      action: { label: "Edit in plan", href: `/campaigns/${campaign?.id}/plan` },
    });
  }

  if (err.includes("encryption") || err.includes("not configured")) {
    fixes.push({
      key: "config",
      title: "Server publish config",
      detail: day.publish_error,
      action: null,
    });
  } else if (err.includes("socialaccount") || err.includes("connect")) {
    fixes.push({
      key: "connect",
      title: `Connect ${day.platform || provider}`,
      detail: day.publish_error,
      action: { label: "Social Hub", href: "/social/connect" },
    });
  } else if (err.includes("video")) {
    fixes.push({
      key: "video",
      title: "Render promo video",
      detail: day.publish_error,
      action: {
        label: "Open Studio",
        href: `/campaigns/${campaign?.id}/video${day.video_project_id ? `?project=${day.video_project_id}` : ""}`,
      },
    });
  } else if (day.publish_error) {
    fixes.push({
      key: "error",
      title: "Publish issue",
      detail: day.publish_error,
      action: onOpenCompose
        ? { label: "Try manual post", onClick: onOpenCompose }
        : { label: "Open plan", href: `/campaigns/${campaign?.id}/plan` },
    });
  }

  if ((provider === "tiktok" || provider === "youtube") && !day.video_project_id) {
    fixes.push({
      key: "video-suggest",
      title: `${day.platform} needs video`,
      detail: "Create a 9:16 promo in Studio before scheduling.",
      action: { label: "Create video", href: `/campaigns/${campaign?.id}/video` },
    });
  }

  if (!fixes.length) return null;

  return (
    <ul className="space-y-2">
      {fixes.map((f) => (
        <li key={f.key} className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm">
          <p className="font-600">{f.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{f.detail}</p>
          {f.action ? (
            f.action.href ? (
              <Button size="sm" variant="outline" className="mt-2 h-8 rounded-full" asChild>
                <Link to={f.action.href}>{f.action.label}</Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-8 rounded-full"
                onClick={f.action.onClick}
              >
                {f.action.label}
              </Button>
            )
          ) : null}
        </li>
      ))}
    </ul>
  );
}
