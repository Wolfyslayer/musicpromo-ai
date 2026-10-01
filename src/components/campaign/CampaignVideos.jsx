import { useNavigate } from "react-router-dom";
import { Plus, Film, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import VideoPreview from "@/components/VideoPreview";
import { getTemplate } from "@/services/videoTemplates";

export default function CampaignVideos({ campaign, videos, song }) {
  const navigate = useNavigate();
  const openEditor = (projectId, remake = false) => {
    const q = new URLSearchParams();
    if (projectId) q.set("project", projectId);
    if (remake) q.set("remake", "1");
    navigate(`/campaigns/${campaign.id}/video?${q.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Promo videos render on your device. Open a video to remake it with a different template or style.
        </p>
        <Button onClick={() => openEditor()} className="rounded-full">
          <Plus className="mr-1.5 h-4 w-4" />
          New Video
        </Button>
      </div>

      {videos.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => {
            const tpl = getTemplate(v.template);
            const ready =
              v.rendering_status === "complete" &&
              v.render_output_url &&
              /^https:\/\//i.test(v.render_output_url);
            return (
              <div
                key={v.id}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-3 transition hover:border-primary/40"
              >
                <button
                  type="button"
                  onClick={() => openEditor(v.id)}
                  className="w-full text-left"
                >
                  <VideoPreview project={{ ...v, lyrics: song?.lyrics }} playing={false} />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-600">{tpl.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.duration || tpl.defaultDuration}s · 9:16
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {v.title || song?.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                    {[v.animation_style, v.text_style].filter(Boolean).join(" · ") || "Default style"}
                  </p>
                </button>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {ready ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wider text-emerald-500">
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {v.rendering_status || "draft"}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-8 rounded-full text-xs"
                    onClick={() => openEditor(v.id, true)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Remake style
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
          description="Create a campaign with artwork + audio to auto-generate a promo, or start a new video here."
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
