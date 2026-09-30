import { useNavigate } from "react-router-dom";
import { Plus, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import VideoPreview from "@/components/VideoPreview";
import { getTemplate } from "@/services/videoTemplates";

export default function CampaignVideos({ campaign, videos, song }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Template-based promo videos. Export is a mock until a renderer is connected.</p>
        <Button onClick={() => navigate(`/campaigns/${campaign.id}/video`)} className="rounded-full"><Plus className="mr-1.5 h-4 w-4" />New Video</Button>
      </div>

      {videos.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => {
            const tpl = getTemplate(v.template);
            return (
              <button key={v.id} onClick={() => navigate(`/campaigns/${campaign.id}/video?project=${v.id}`)} className="text-left">
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-3 transition hover:border-primary/40">
                  <VideoPreview project={{ ...v, lyrics: song?.lyrics }} />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-600">{tpl.name}</span>
                    <span className="text-xs text-muted-foreground">{v.duration || tpl.defaultDuration}s · 9:16</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{v.title || song?.title}</p>
                  {v.rendering_status && v.rendering_status !== "not_started" && (
                    <span className="mt-1 inline-block rounded-full bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{v.rendering_status}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Film} title="No videos yet" description="Generate a promo video from a template." action={<Button onClick={() => navigate(`/campaigns/${campaign.id}/video`)} className="rounded-full"><Plus className="mr-1.5 h-4 w-4" />New Video</Button>} />
      )}
    </div>
  );
}