import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Film, RefreshCw, CheckCircle2, Clapperboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import VideoPreview from "@/components/VideoPreview";
import VideoRenderProgress from "@/components/VideoRenderProgress";
import { getTemplate } from "@/services/videoTemplates";
import { videoService } from "@/services/videoService";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";

function isReady(v) {
  return v.rendering_status === "complete" && v.render_output_url && /^https:\/\//i.test(v.render_output_url);
}

export default function CampaignVideos({ campaign, videos, song, onRefresh }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requireAuth } = useAuth();
  const [batching, setBatching] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);

  const sorted = useMemo(
    () =>
      [...videos].sort((a, b) => {
        const da = Number(a.animation_settings?.dayNumber) || 0;
        const db = Number(b.animation_settings?.dayNumber) || 0;
        return da - db || String(a.created_date || "").localeCompare(String(b.created_date || ""));
      }),
    [videos]
  );

  const drafts = sorted.filter((v) => !isReady(v));

  const openEditor = (projectId, remake = false, dayId = "") => {
    const q = new URLSearchParams();
    if (projectId) q.set("project", projectId);
    if (dayId) q.set("day", dayId);
    if (remake) q.set("remake", "1");
    q.set("videoType", "promo");
    navigate(`/campaigns/${campaign.id}/video?${q.toString()}`);
  };

  const renderAllDrafts = () =>
    requireAuth(async () => {
      if (!drafts.length) return;
      setBatching(true);
      setBatchProgress({ progress: 0, message: "Starting batch render…" });
      let done = 0;
      try {
        for (const project of drafts) {
          setBatchProgress({
            progress: Math.round((done / drafts.length) * 100),
            message: `Rendering day ${project.animation_settings?.dayNumber || done + 1}…`,
          });
          const res = await videoService.exportVideo(project, {
            onProgress: (info) => {
              const slice = done / drafts.length + (info.progress || 0) / 100 / drafts.length;
              setBatchProgress({
                progress: Math.round(slice * 100),
                message: info.message || "Encoding…",
              });
            },
          });
          if (res.status === "failed") {
            throw new Error(res.message || "Render failed");
          }
          done += 1;
        }
        setBatchProgress({ progress: 100, message: "All drafts exported" });
        toast({ title: "Videos ready", description: `Rendered ${done} promo clip${done === 1 ? "" : "s"} on this device.` });
        onRefresh?.();
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Batch render stopped",
          description: err?.message || "Try rendering one video at a time in the editor.",
        });
      } finally {
        setBatching(false);
        setTimeout(() => setBatchProgress(null), 1200);
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Each plan day can have its own promo. Drafts use your song, cover, and AI hooks — export on this device.
        </p>
        <div className="flex flex-wrap gap-2">
          {drafts.length > 1 ? (
            <Button
              variant="outline"
              className="rounded-full"
              disabled={batching}
              onClick={renderAllDrafts}
            >
              {batching ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Clapperboard className="mr-1.5 h-4 w-4" />
              )}
              Render {drafts.length} drafts
            </Button>
          ) : null}
          <Button onClick={() => openEditor()} className="rounded-full">
            <Plus className="mr-1.5 h-4 w-4" />
            New Video
          </Button>
        </div>
      </div>

      {batchProgress ? (
        <VideoRenderProgress progress={batchProgress.progress} message={batchProgress.message} />
      ) : null}

      {sorted.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((v) => {
            const tpl = getTemplate(v.template);
            const ready = isReady(v);
            const dayNum = v.animation_settings?.dayNumber;
            return (
              <div
                key={v.id}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-3 transition hover:border-primary/40"
              >
                <button
                  type="button"
                  onClick={() => openEditor(v.id, false, v.campaign_day_id || "")}
                  className="w-full text-left"
                >
                  <VideoPreview project={{ ...v, lyrics: song?.lyrics }} playing={false} />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-600">
                      {dayNum ? `Day ${dayNum}` : tpl.name}
                      {dayNum ? ` · ${tpl.name}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {v.duration || tpl.defaultDuration}s · 9:16
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {v.text || v.title || song?.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                    {[v.visual_style, v.particle_effect].filter(Boolean).join(" · ") || "Default style"}
                  </p>
                </button>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {ready ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wider text-emerald-500">
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Draft · tap Export in editor
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-8 rounded-full text-xs"
                    onClick={() => openEditor(v.id, true, v.campaign_day_id || "")}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    {ready ? "Remake" : "Edit & export"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Film}
          title="No videos yet"
          description="Create a campaign with artwork + audio and a promo style — each plan day gets a video draft automatically."
          action={
            <Button onClick={() => openEditor()} className="rounded-full">
              <Plus className="mr-1.5 h-4 w-4" />
              New Video
            </Button>
          }
        />
      )}
    </div>
  );
}
