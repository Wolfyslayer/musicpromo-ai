import { Link } from "react-router-dom";
import { Calendar, Film, MoreVertical } from "lucide-react";
import ArtworkImage from "./ArtworkImage";
import StatusBadge from "./StatusBadge";
import { fmtDate, fmtDateShort, daysUntil } from "@/services/format";

export default function CampaignCard({ campaign, song, artist, daysCount = 0, videosCount = 0, onAction }) {
  return (
    <Link
      to={`/campaigns/${campaign.id}`}
      className="group block overflow-hidden rounded-2xl border border-border/60 card-gradient transition hover:border-primary/40 animate-slide-up"
    >
      <div className="flex gap-3 p-3">
        <ArtworkImage
          src={song?.artwork_url}
          alt={song?.title}
          className="h-20 w-20 shrink-0"
          rounded="rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-heading font-600">{song?.title || "Untitled"}</h3>
              <p className="truncate text-sm text-muted-foreground">{artist?.name || "Unknown artist"}</p>
            </div>
            {onAction ? (
              <button
                onClick={(e) => { e.preventDefault(); onAction(campaign); }}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            {campaign.is_demo && (
              <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-500 uppercase tracking-wider text-muted-foreground">
                Demo
              </span>
            )}
          </div>
          {campaign.release?.title && (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              Release: {campaign.release.title}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {fmtDateShort(campaign.start_date)} — {fmtDateShort(campaign.end_date)}
        </span>
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1">{daysCount} days</span>
          <span className="inline-flex items-center gap-1"><Film className="h-3.5 w-3.5" />{videosCount}</span>
        </span>
      </div>
    </Link>
  );
}

export function CampaignCountdown({ campaign }) {
  const d = daysUntil(campaign.start_date);
  if (campaign.status === "active") return <span className="text-chart-2">Live now</span>;
  if (d === null) return null;
  if (d < 0) return <span>Started {fmtDate(campaign.start_date)}</span>;
  if (d === 0) return <span className="text-chart-3">Starts today</span>;
  return <span>Starts in {d} day{d === 1 ? "" : "s"}</span>;
}