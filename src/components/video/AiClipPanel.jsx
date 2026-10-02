import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { COMPOSITING_MODES, normalizeCompositingMode } from "@/remotion/styles";
import { generateAiVideoClip } from "@/services/aiVideoService";
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
  const mode = normalizeCompositingMode(project?.compositing_mode);
  const hasClip = Boolean(project?.ai_clip_url);

  const generate = () =>
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
        });
        onPatch?.({
          ai_clip_url: res.videoUrl,
          ai_clip_preview_url: res.videoUrl,
          ai_clip_status: "ready",
          ai_clip_prompt: prompt,
          compositing_mode: mode === "artwork" ? "ai_blend" : mode,
        });
        onStyleTouch?.();
        toast({
          title: "AI motion clip ready",
          description: res.billingNote || "Layer it in the preview, then export to bake with your song.",
        });
      } catch (err) {
        onPatch?.({ ai_clip_status: "failed" });
        toast({
          variant: "destructive",
          title: "AI clip failed",
          description: err?.message || "Check REPLICATE_API_TOKEN in Supabase secrets.",
        });
      } finally {
        setGenerating(false);
      }
    });

  return (
    <div className="space-y-4 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
      <div className="flex items-start gap-2">
        <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
        <div>
          <p className="text-sm font-600">AI motion clip (pay-per-use)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Replicate image→video from your cover (~$0.02–0.08/clip). Clips save to your promo bucket so you can
            overlay hooks, lyrics, and particles — then export one MP4 with your audio.
          </p>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Motion note (stored for your reference)</Label>
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

      <div>
        <Label className="text-xs text-muted-foreground">How to use the clip</Label>
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
              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
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

      {hasClip ? (
        <div>
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

      <Button
        type="button"
        className="w-full rounded-full"
        disabled={generating}
        onClick={generate}
      >
        {generating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {hasClip ? "Regenerate AI clip" : "Generate AI clip from cover"}
      </Button>

      {hasClip ? (
        <p className="text-[11px] text-muted-foreground">
          Clip loops under your export length. Tweak typography and effects, then Export to merge with your track.
        </p>
      ) : null}
    </div>
  );
}
