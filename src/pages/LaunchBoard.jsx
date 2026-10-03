import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Globe2,
  Loader2,
  Megaphone,
  Share2,
  Sparkles,
} from "lucide-react";
import ArtworkImage from "@/components/ArtworkImage";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import SurfacePanel from "@/components/SurfacePanel";
import { Button } from "@/components/ui/button";
import { loadLaunchBoard } from "@/services/data";
import { fmtDate } from "@/services/format";
import { buildComposePath } from "@/services/socialService";

function TimelineRow({ item, navigate }) {
  if (item.kind === "release_date") {
    return (
      <div className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-600 uppercase tracking-wider text-primary">Release day</p>
          <p className="font-600">{item.title}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(item.date)}</p>
        </div>
      </div>
    );
  }

  if (item.kind === "campaign_meta") {
    const c = item.campaign;
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{fmtDate(item.date)} · Campaign</p>
          <p className="font-600">{c.name || c.song?.title || "Campaign"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            {item.communityShare ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                <Globe2 className="h-3 w-3" /> Community feed
              </span>
            ) : null}
            {item.crossPromo ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                <Megaphone className="h-3 w-3" /> Launch-week cross-promo
              </span>
            ) : null}
          </div>
        </div>
        <Button size="sm" variant="outline" className="rounded-full" asChild>
          <Link to={`/campaigns/${c.id}/plan`}>Open plan</Link>
        </Button>
      </div>
    );
  }

  const day = item.day;
  const campaign = item.campaign;
  const post = item.posts?.[0];
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/50 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {fmtDate(item.date)} · Day {day.day_number ?? "—"} · {campaign?.name || "Campaign"}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm">{day.caption || day.theme || "No caption yet"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={day.status || "pending"} />
          {post ? <StatusBadge status={post.status} /> : null}
          {day.publish_error ? (
            <span className="text-xs text-destructive">{day.publish_error}</span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => navigate(`/campaigns/${campaign.id}/plan`)}
        >
          Plan
        </Button>
        <Button
          size="sm"
          className="rounded-full"
          onClick={() =>
            navigate(
              buildComposePath({
                campaignId: campaign.id,
                campaignDayId: day.id,
                releaseId: campaign.release_id,
              })
            )
          }
        >
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          Social
        </Button>
      </div>
    </div>
  );
}

export default function LaunchBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadLaunchBoard(id)
      .then(setData)
      .catch((e) => setError(e.message || "Could not load launch board"))
      .finally(() => setLoading(false));
  }, [id]);

  const dayTimeline = useMemo(
    () => (data?.timeline || []).filter((t) => t.kind === "day" || t.kind === "release_date"),
    [data]
  );

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate(`/releases/${id}`)}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Release
        </Button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { release, artist, campaigns, issues } = data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="rounded-full" asChild>
        <Link to={`/releases/${id}`}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to release
        </Link>
      </Button>

      <PageHeader
        eyebrow="Launch board"
        title={release.title || "Untitled release"}
        description={`${artist?.name || "Artist"} — one timeline for rollout, social queue, and Community.`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link to={`/releases/${id}/calendar`}>
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Calendar
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link to="/social/health">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Social health
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex gap-4 overflow-hidden rounded-3xl border border-border/60 surface p-5">
        <ArtworkImage src={release.artwork_url} alt={release.title} className="h-24 w-24 shrink-0 rounded-2xl" />
        <div className="min-w-0">
          <StatusBadge status={release.status || "draft"} />
          <p className="mt-2 text-sm text-muted-foreground">Release {fmtDate(release.release_date)}</p>
          <p className="mt-1 text-sm">
            {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} · {data.entries.length} planned day
            {data.entries.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {issues.length ? (
        <SurfacePanel className="space-y-2 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 text-sm font-600">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {issues.length} item{issues.length === 1 ? "" : "s"} need attention
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {issues.slice(0, 6).map((issue) => (
              <li key={`${issue.type}-${issue.dayId}`}>
                {issue.type === "missing_caption" ? "Missing caption" : "Publish error"} on {fmtDate(issue.date)}
                {issue.message ? ` — ${issue.message}` : ""}
              </li>
            ))}
          </ul>
        </SurfacePanel>
      ) : null}

      {(data.timeline || [])
        .filter((t) => t.kind === "campaign_meta")
        .map((item) => (
          <TimelineRow key={`meta-${item.campaign.id}`} item={item} navigate={navigate} />
        ))}

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Timeline</h2>
        {dayTimeline.length ? (
          dayTimeline.map((item, idx) => (
            <TimelineRow key={`${item.kind}-${item.date}-${idx}`} item={item} navigate={navigate} />
          ))
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No planned days yet"
            description="Generate a campaign plan or open the calendar to schedule your rollout."
            action={
              campaigns[0] ? (
                <Button className="rounded-full" asChild>
                  <Link to={`/campaigns/${campaigns[0].id}/plan`}>Open campaign plan</Link>
                </Button>
              ) : (
                <Button className="rounded-full" onClick={() => navigate("/create")}>
                  Create campaign
                </Button>
              )
            }
          />
        )}
      </section>
    </div>
  );
}
