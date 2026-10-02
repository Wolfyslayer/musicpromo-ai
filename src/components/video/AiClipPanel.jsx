import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wand2, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  ARTWORK_MOTION_MODES,
  COMPOSITING_MODES,
  normalizeArtworkMotion,
  normalizeCompositingMode,
} from "@/remotion/styles";
import { fetchAiVideoStatus, generateAiVideoClip } from "@/services/aiVideoService";
import { resolvePublicArtworkUrl } from "@/services/videoService";
import { useToast } from "@/components/ui/use-toast";

export default function AiClipPanel({
  project,
  artworkFile,
  onPatch,
  onStyleTouch,
  requireAuth,
}) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(null);
  const mode = normalizeCompositingMode(project?.compositing_mode);
  const motion = normalizeArtworkMotion(project?.artwork_motion);
  const hasClip = Boolean(project?.ai_clip_url);

  useEffect(() => {
    fetchAiVideoStatus().then(setCloudStatus).catch(() => setCloudStatus({ configured: false }));
  }, []);

  const generateCloud = () =>
    requireAuth(async () => {
      setGenerating(true);
      try {
        const imageUrl = await resolvePublicArtworkUrl(project?.artwork_url, artworkFile);
        if (!imageUrl) {
          throw new Error("Upload artwork before generating AI motion.");
        }
        const prompt =
          project?.ai_clip_prompt ||
          project?.animation_settings?.videoConcept ||
          project?.text ||
          "Slow cinematic motion from album artwork, music promo.";
        onPatch?.({ ai_clip_status: "generating" });
        const res = await generateAiVideoClip({
          imageUrl,
          prompt,
          projectId: project?.id || "",
          songTitle: project?.title || "",
          useLlmPrompt: true,
        });
        onPatch?.({
          ai_clip_url: res.videoUrl,
          ai_clip_preview_url: res.videoUrl,
          ai_clip_status: "ready",
          ai_clip_prompt: res.motionPrompt || prompt,
          compositing_mode: mode === "artwork" ? "ai_blend" : mode,
        });
        onStyleTouch?.();
        toast({
          title: "Cloud motion clip ready",
          description: [res.billingNote, res.groqNote].filter(Boolean).join(" "),
        });
      } catch (err) {
        onPatch?.({ ai_clip_status: "failed" });
        toast({
          variant: "destructive",
          title: "Cloud clip failed",
          description: err?.message || "Configure FAL_KEY or use free cinematic motion below.",
        });
      } finally {
        setGenerating(false);
      }
    });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
        <div className="flex items-start gap-2">
          <Clapperboard className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div>
            <p className="text-sm font-600">Free cinematic motion</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No API cost — Remotion animates your cover (Ken Burns + audio reactive). Groq only helps write campaign
              copy; it cannot generate video pixels.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          {ARTWORK_MOTION_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onPatch?.({ artwork_motion: item.id });
                onStyleTouch?.();
              }}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                motion === item.id
                  ? "border-emerald-400/60 bg-emerald-500/15"
                  : "border-border hover:border-emerald-400/30"
              }`}
            >
              <span className="font-600">{item.label}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
        <div className="flex items-start gap-2">
          <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
          <div>
            <p className="text-sm font-600">Optional cloud AI clip (pay-per-use)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {cloudStatus?.configured
                ? cloudStatus.note
                : "Not configured — add FAL_KEY (recommended, fal.ai Wan ~$0.20/clip at 480p) or REPLICATE_API_TOKEN with model wavespeedai/wan-2.1-i2v-480p in Supabase secrets."}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <Label className="text-xs text-muted-foreground">Motion note (Groq can refine this text only)</Label>
          <Textarea
            className="mt-1.5 rounded-xl text-sm"
            rows={2}
            value={project?.ai_clip_prompt || ""}
            onChange={(e) => {
              onPatch?.({ ai_clip_prompt: e.target.value });
              onStyleTouch?.();
            }}
            placeholder="e.g. Slow zoom, neon pulse, dreamy parallax…"
          />
        </div>

        {hasClip ? (
          <div className="mt-3">
            <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>AI layer strength</span>
              <span>{Math.round((project?.ai_clip_opacity ?? 1) * 100)}%</span>
            </div>
            <Slider
              value={[Math.round((project?.ai_clip_opacity ?? 1) * 100)]}
              min={15}
              max={100}
              step={5}
              onValueChange={(v) => {
                onPatch?.({ ai_clip_opacity: v[0] / 100 });
                onStyleTouch?.();
              }}
            />
          </div>
        ) : null}

        <div className="mt-3">
          <Label className="text-xs text-muted-foreground">Cloud clip compositing</Label>
          <div className="mt-2 grid gap-2">
            {COMPOSITING_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!hasClip && item.id !== "artwork"}
                onClick={() => {
                  onPatch?.({ compositing_mode: item.id });
                  onStyleTouch?.();
                }}
                className={`rounded-xl border px-3 py-2 text-left text-sm ${
                  mode === item.id
                    ? "border-violet-400/60 bg-violet-500/15"
                    : "border-border hover:border-violet-400/30"
                } ${!hasClip && item.id !== "artwork" ? "opacity-50" : ""}`}
              >
                <span className="font-600">{item.label}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.description}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full rounded-full border-violet-400/40"
          disabled={generating || !cloudStatus?.configured}
          onClick={generateCloud}
        >
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {hasClip ? "Regenerate cloud clip" : "Generate cloud clip from cover"}
        </Button>
        {!cloudStatus?.configured ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Skip this if you want zero video API cost — use Cinematic or Hype motion above, then Export.
          </p>
        ) : null}
      </section>
    </div>
  );
}
