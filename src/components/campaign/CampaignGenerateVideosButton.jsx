import { useMemo, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoRenderProgress from "@/components/VideoRenderProgress";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import {
  countVideosNeedingExport,
  oneClickGenerateCampaignVideos,
} from "@/services/campaignVideoOneClick";

/**
 * Primary one-click encode for existing campaigns (hook clip + Remotion batch).
 */
export default function CampaignGenerateVideosButton({
  campaign,
  days,
  videos,
  song,
  artistName = "",
  release = null,
  onComplete,
  size = "default",
  className = "",
  variant = "default",
}) {
  const { toast } = useToast();
  const { requireAuth, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  const { missing, draft, total } = useMemo(
    () => countVideosNeedingExport(days, videos),
    [days, videos]
  );

  const label =
    total === 0
      ? "All videos ready"
      : missing + draft === 1
        ? "Generate promo video"
        : `Generate ${missing + draft} promo videos`;

  const run = () =>
    requireAuth(async () => {
      if (total === 0) {
        toast({ title: "Videos ready", description: "Every plan day already has an exported MP4." });
        return;
      }
      setBusy(true);
      setProgress({ progress: 0, message: "Starting…" });
      try {
        const result = await oneClickGenerateCampaignVideos({
          campaign,
          days,
          videos,
          song,
          artistName,
          release,
          userId: user?.id || "",
          onProgress: setProgress,
          onStage: (msg) => setProgress((p) => ({ ...(p || {}), message: msg })),
        });
        if (result.skipped) {
          toast({ title: "Nothing to encode", description: result.message });
        } else {
          toast({
            title: "Promo videos ready",
            description: `Encoded ${result.rendered} clip${result.rendered === 1 ? "" : "s"}. Edit any day in the studio before you schedule.`,
          });
        }
        onComplete?.();
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Video generation failed",
          description: e?.message || "Try again in Chrome or Firefox with the tab open.",
        });
      } finally {
        setBusy(false);
        setTimeout(() => setProgress(null), 1500);
      }
    });

  return (
    <div className={className}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className="rounded-full"
        disabled={busy || total === 0}
        onClick={run}
      >
        {busy ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-1.5 h-4 w-4" />
        )}
        {busy ? "Generating…" : label}
      </Button>
      {progress ? (
        <div className="mt-3">
          <VideoRenderProgress progress={progress.progress} message={progress.message} />
        </div>
      ) : null}
    </div>
  );
}
