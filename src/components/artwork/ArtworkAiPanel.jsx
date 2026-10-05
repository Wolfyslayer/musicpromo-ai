import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import ArtworkImage from "@/components/ArtworkImage";
import {
  fetchCoverArtAiStatus,
  fileToCoverReferencePng,
  generateCoverArtWithAi,
  urlToCoverReferencePng,
} from "@/services/artworkStudioService";

export default function ArtworkAiPanel({ onImageReady, requireAuth }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [referencePreview, setReferencePreview] = useState("");
  const [referenceBase64, setReferenceBase64] = useState("");
  const [form, setForm] = useState({
    title: "",
    artistName: "",
    genre: "",
    mood: "",
    prompt: "",
  });

  const isEditMode = Boolean(referenceBase64);

  useEffect(() => {
    fetchCoverArtAiStatus()
      .then(setStatus)
      .catch(() => setStatus({ configured: false }));
  }, []);

  const setReferenceFromPrepared = ({ base64 }) => {
    setReferenceBase64(base64);
    setReferencePreview(`data:image/png;base64,${base64}`);
  };

  const clearReference = () => {
    setReferenceBase64("");
    setReferencePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPickFile = async (file) => {
    if (!file) return;
    try {
      const prepared = await fileToCoverReferencePng(file);
      setReferenceFromPrepared(prepared);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not use image", description: e.message });
    }
  };

  const useResultAsReference = async () => {
    if (!resultUrl) return;
    setBusy(true);
    try {
      const prepared = await urlToCoverReferencePng(resultUrl);
      setReferenceFromPrepared(prepared);
      toast({ title: "Using last result", description: "Describe your next edit below." });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not load result", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const generate = () => {
    const run = async () => {
      if (isEditMode && !form.prompt.trim()) {
        toast({
          variant: "destructive",
          title: "Add edit instructions",
          description: 'Example: "make the background darker and add gold accents"',
        });
        return;
      }
      if (!isEditMode && !form.prompt.trim() && !form.title.trim() && !form.mood.trim()) {
        toast({
          variant: "destructive",
          title: "Add a prompt",
          description: "Describe the cover or fill in title / mood.",
        });
        return;
      }

      setBusy(true);
      try {
        const payload = {
          ...form,
          useLlmPrompt: true,
        };
        if (referenceBase64) {
          payload.referenceImageBase64 = referenceBase64;
        }
        const data = await generateCoverArtWithAi(payload);
        setResultUrl(data.imageUrl || "");
        onImageReady?.(data.imageUrl);
        toast({
          title: data.mode === "edit" ? "Edit applied" : "Cover generated",
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
              Start from a prompt, or upload a photo and describe edits (Gemini). Square output; add titles in the
              Design tab.
            </p>
          </div>
        </div>

        {!status?.configured ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            AI covers need <strong className="font-semibold">GEMINI_API_KEY</strong> (Google AI Studio — same Supabase
            secrets as campaign AI). You can still use the Design editor below.
          </p>
        ) : null}

        <div className="space-y-2">
          <Label>Reference photo (optional)</Label>
          <div
            className="relative flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              onPickFile(file);
            }}
          >
            {referencePreview ? (
              <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:items-start">
                <ArtworkImage
                  src={referencePreview}
                  alt="Reference"
                  className="h-24 w-24 shrink-0"
                  rounded="rounded-lg"
                />
                <div className="min-w-0 flex-1 text-left text-sm">
                  <p className="font-medium text-foreground">Editing this image</p>
                  <p className="text-xs text-muted-foreground">
                    Your prompt below tells the model what to change. Upload a new file to replace.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={clearReference}>
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove reference</span>
                </Button>
              </div>
            ) : (
              <>
                <ImagePlus className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop a cover or photo here, or choose a file</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload image
                </Button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
          </div>
          {resultUrl && !referencePreview ? (
            <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={useResultAsReference}>
              Use last generated cover as starting point
            </Button>
          ) : null}
          {status?.configured && !status?.supportsImageEdit ? (
            <p className="text-xs text-amber-200/80">Photo edits need Gemini or OpenAI (not fal/Replicate-only).</p>
          ) : null}
        </div>

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
          <Label htmlFor="cover-prompt">{isEditMode ? "What should change?" : "Visual direction"}</Label>
          <Textarea
            id="cover-prompt"
            value={form.prompt}
            onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
            placeholder={
              isEditMode
                ? "Make the sky deep purple, add soft film grain, keep the face the same…"
                : "Purple city skyline, rain on glass, silhouette at the window…"
            }
            rows={4}
            className="rounded-xl"
          />
        </div>

        <Button
          type="button"
          className="min-h-11 w-full rounded-full sm:w-auto"
          disabled={busy || !status?.configured || (isEditMode && !status?.supportsImageEdit)}
          onClick={generate}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {isEditMode ? "Apply edit" : "Generate cover"}
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
          <>
            <Button variant="outline" className="rounded-full" asChild>
              <a href={resultUrl} download target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download PNG
              </a>
            </Button>
            {status?.supportsImageEdit ? (
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={useResultAsReference}>
                Edit this result again
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
