import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, Rocket } from "lucide-react";
import ArtworkImage from "@/components/ArtworkImage";
import ProgressBar from "@/components/ProgressBar";
import StatusBadge from "@/components/StatusBadge";
import SurfacePanel from "@/components/SurfacePanel";
import { Button } from "@/components/ui/button";
import { loadLaunchBoard } from "@/services/data";
import { fmtDate } from "@/services/format";

/**
 * Dashboard embed: next steps on the active release launch board.
 */
export default function LaunchBoardSummary({ campaign, releaseId, readyVideosCount = 0 }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(releaseId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!releaseId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadLaunchBoard(releaseId)
      .then(setData)
      .catch((e) => setError(e.message || "Could not load launch board"))
      .finally(() => setLoading(false));
  }, [releaseId, campaign?.id]);

  const upcoming = useMemo(() => {
    const days = (data?.entries || []).filter((d) => d.date);
    const today = new Date().toISOString().slice(0, 10);
    return days
      .filter((d) => String(d.date) >= today || d.status !== "complete")
      .slice(0, 4);
  }, [data]);

  if (!releaseId) return null;

  const release = data?.release;
  return (
    <SurfacePanel className="space-y-4 overflow-hidden p-0">
      <button
        type="button"
        onClick={() => navigate(`/releases/${releaseId}/launch`)}
        className="flex w-full flex-col gap-4 p-4 text-left transition hover:bg-muted/20 sm:flex-row sm:items-center sm:p-5"
      >
        <ArtworkImage
          src={release?.artwork_url || campaign?.song?.artwork_url}
          alt={release?.title || campaign?.song?.title}
          className="h-32 w-32 shrink-0 sm:h-28 sm:w-28"
          rounded="rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Rocket className="h-3 w-3" /> Launch board
            </span>
            <StatusBadge status={campaign?.status} />
          </div>
          <h2 className="mt-2 truncate font-heading text-xl font-semibold">
            {release?.title || campaign?.song?.title || "Active rollout"}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {campaign?.artist?.name}
            {release?.release_date ? ` · Release ${fmtDate(release.release_date)}` : ""}
          </p>
          <div className="mt-3 max-w-md">
            <ProgressBar value={campaign?.progressValue || 0} showLabel />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {readyVideosCount} video{readyVideosCount === 1 ? "" : "s"} ready · Tap for full timeline
          </p>
        </div>
        <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
      </button>

      <div className="border-t border-border/40 px-4 pb-4 sm:px-5">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            {data?.issues?.length ? (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {data.issues.length} item{data.issues.length === 1 ? "" : "s"} need attention on your launch board
              </div>
            ) : null}
            <p className="mb-2 text-xs font-600 uppercase tracking-wider text-muted-foreground">Up next</p>
            {upcoming.length ? (
              <ul className="space-y-2">
                {upcoming.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-500">
                        Day {d.day_number ?? "—"} · {fmtDate(d.date)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{d.caption || d.theme || "No caption"}</p>
                    </div>
                    <StatusBadge status={d.status || "pending"} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming plan days — open the board to build your rollout.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="rounded-full" asChild>
                <Link to={`/releases/${releaseId}/launch`}>Open launch board</Link>
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" asChild>
                <Link to={`/campaigns/${campaign.id}/plan`}>Campaign plan</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </SurfacePanel>
  );
}
