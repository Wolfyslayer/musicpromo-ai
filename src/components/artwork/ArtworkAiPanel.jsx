import { useEffect, useState } from "react";
import { Loader2, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import ArtworkImage from "@/components/ArtworkImage";
import { fetchCoverArtAiStatus, generateCoverArtWithAi } from "@/services/artworkStudioService";

export default function ArtworkAiPanel({ onImageReady, requireAuth }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [form, setForm] = useState({
    title: "",
    artistName: "",
    genre: "",
    mood: "",
    prompt: "",
  });

  useEffect(() => {
    fetchCoverArtAiStatus()
      .then(setStatus)
      .catch(() => setStatus({ configured: false }));
  }, []);

  const generate = () => {
    const run = async () => {
      setBusy(true);
      try {
        const data = await generateCoverArtWithAi({
          ...form,
          useLlmPrompt: true,
        });
        setResultUrl(data.imageUrl || "");
        onImageReady?.(data.imageUrl);
        toast({
          title: "Cover generated",
          description: data.billingNote || "Saved to your library URL.",
        });
      } catch (e) {
        toast({ variant: "destructive", title: "Generation failed", description: e.message });
      } finally {
        setBusy(false);
      }
    };
    if (typeof requireAuth === "function") requireAuth(run);
    else run();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-heading text-lg font-semibold">AI album cover</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Describe the vibe — we expand it into a Flux prompt and return a square cover (no text baked in; add
              titles in the Design tab).
            </p>
          </div>
        </div>

        {!status?.configured ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            AI covers need <strong className="font-semibold">FAL_KEY</strong> or{" "}
            <strong className="font-semibold">REPLICATE_API_TOKEN</strong> in Supabase (same as AI video). You can still
            use the Design editor below.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cover-title">Album / single title</Label>
            <Input
              id="cover-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Midnight Drive"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cover-artist">Artist name</Label>
            <Input
              id="cover-artist"
              value={form.artistName}
              onChange={(e) => setForm((f) => ({ ...f, artistName: e.target.value }))}
              placeholder="Your artist name"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cover-genre">Genre</Label>
            <Input
              id="cover-genre"
              value={form.genre}
              onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
              placeholder="R&B, pop, hip-hop…"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cover-mood">Mood</Label>
            <Input
              id="cover-mood"
              value={form.mood}
              onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value }))}
              placeholder="Neon, dreamy, gritty…"
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cover-prompt">Visual direction</Label>
          <Textarea
            id="cover-prompt"
            value={form.prompt}
            onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
            placeholder="Purple city skyline, rain on glass, silhouette at the window…"
            rows={4}
            className="rounded-xl"
          />
        </div>

        <Button
          type="button"
          className="min-h-11 w-full rounded-full sm:w-auto"
          disabled={busy || !status?.configured}
          onClick={generate}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate cover
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="aspect-square w-full max-w-sm overflow-hidden rounded-3xl border border-border/70 bg-muted/30 shadow-xl">
          {resultUrl ? (
            <ArtworkImage src={resultUrl} alt="Generated cover" className="h-full w-full" rounded="rounded-3xl" />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Preview appears here
            </div>
          )}
        </div>
        {resultUrl ? (
          <Button variant="outline" className="rounded-full" asChild>
            <a href={resultUrl} download target="_blank" rel="noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Download PNG
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
