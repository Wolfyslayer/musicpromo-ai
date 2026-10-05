import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  ImagePlus,
  Loader2,
  PenLine,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import ArtworkImage from "@/components/ArtworkImage";
import { cn } from "@/lib/utils";
import {
  fetchCoverArtAiStatus,
  fileToCoverReferencePng,
  generateCoverArtWithAi,
  urlToCoverReferencePng,
} from "@/services/artworkStudioService";
import { billingFailureToast } from "@/lib/billingErrors";

function newMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ArtworkAiPanel({ onImageReady, requireAuth }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("compose");
  const [albumTitle, setAlbumTitle] = useState("");
  const [composePrompt, setComposePrompt] = useState("");
  const [composeReferenceBase64, setComposeReferenceBase64] = useState("");
  const [composeReferencePreview, setComposeReferencePreview] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [latestImageUrl, setLatestImageUrl] = useState("");

  useEffect(() => {
    fetchCoverArtAiStatus()
      .then(setStatus)
      .catch(() => setStatus({ configured: false }));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy, phase]);

  const setReferenceFromPrepared = ({ base64 }) => {
    setComposeReferenceBase64(base64);
    setComposeReferencePreview(`data:image/png;base64,${base64}`);
  };

  const clearComposeReference = () => {
    setComposeReferenceBase64("");
    setComposeReferencePreview("");
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

  const resetSession = () => {
    setPhase("compose");
    setMessages([]);
    setLatestImageUrl("");
    setFollowUpInput("");
    setComposePrompt("");
    clearComposeReference();
  };

  const runGeneration = async ({ prompt, referenceBase64, isFollowUp }) => {
    const trimmed = String(prompt || "").trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "Add a prompt", description: "Describe the cover or what to change." });
      return;
    }

    setBusy(true);
    const userMsg = { id: newMessageId(), role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const payload = {
        title: albumTitle.trim(),
        prompt: trimmed,
        useLlmPrompt: !isFollowUp,
      };
      if (referenceBase64) {
        payload.referenceImageBase64 = referenceBase64;
      }

      const data = await generateCoverArtWithAi(payload);
      const imageUrl = data.imageUrl || "";
      setLatestImageUrl(imageUrl);
      onImageReady?.(imageUrl);

      setMessages((prev) => [
        ...prev,
        {
          id: newMessageId(),
          role: "assistant",
          imageUrl,
          text: data.mode === "edit" ? "Updated cover" : "Generated cover",
        },
      ]);

      if (isFollowUp) {
        setFollowUpInput("");
      }

      toast({
        title: data.mode === "edit" ? "Cover updated" : "Cover ready",
        description: data.billingNote || "Use the chat below to request more changes.",
      });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      const fail = billingFailureToast(e);
      toast({ variant: "destructive", title: fail.title, description: fail.description });
    } finally {
      setBusy(false);
    }
  };

  const startSession = () => {
    const run = async () => {
      if (!composePrompt.trim() && !albumTitle.trim() && !composeReferenceBase64) {
        toast({
          variant: "destructive",
          title: "Add a prompt",
          description: "Paste or write your visual direction, or add an album title.",
        });
        return;
      }
      setPhase("session");
      setMessages([]);
      setLatestImageUrl("");
      await runGeneration({
        prompt: composePrompt.trim() || `Album cover art for "${albumTitle.trim()}"`,
        referenceBase64: composeReferenceBase64 || undefined,
        isFollowUp: false,
      });
    };
    if (typeof requireAuth === "function") requireAuth(run);
    else run();
  };

  const sendFollowUp = () => {
    const run = async () => {
      if (!latestImageUrl) {
        toast({ variant: "destructive", title: "No image yet", description: "Generate a cover first." });
        return;
      }
      if (!status?.supportsImageEdit) {
        toast({
          variant: "destructive",
          title: "Edits not available",
          description: "Configure Gemini or OpenAI for image edits, or start a new prompt.",
        });
        return;
      }
      let base64 = "";
      try {
        const prepared = await urlToCoverReferencePng(latestImageUrl);
        base64 = prepared.base64;
      } catch (e) {
        toast({ variant: "destructive", title: "Could not load last image", description: e.message });
        return;
      }
      await runGeneration({
        prompt: followUpInput,
        referenceBase64: base64,
        isFollowUp: true,
      });
    };
    if (typeof requireAuth === "function") requireAuth(run);
    else run();
  };

  if (phase === "session") {
    return (
      <div className="flex min-h-[min(720px,calc(100dvh-12rem))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
          <Button type="button" variant="ghost" size="sm" className="rounded-full gap-1.5" onClick={resetSession}>
            <ArrowLeft className="h-4 w-4" />
            New prompt
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {albumTitle.trim() ? albumTitle.trim() : "Cover session"}
            </p>
            <p className="text-xs text-muted-foreground">Describe changes below — each message refines the last image</p>
          </div>
          {latestImageUrl ? (
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <a href={latestImageUrl} download target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          ) : null}
        </div>

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-muted/15 px-4 py-5 sm:px-6">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[min(100%,520px)] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="max-w-[min(100%,420px)] space-y-2">
                  {m.text ? <p className="text-xs font-medium text-muted-foreground">{m.text}</p> : null}
                  {m.imageUrl ? (
                    <div className="overflow-hidden rounded-2xl border border-border/60 shadow-md">
                      <ArtworkImage src={m.imageUrl} alt="Generated cover" className="w-full" rounded="rounded-none" />
                    </div>
                  ) : null}
                </div>
              </div>
            )
          )}
          {busy ? (
            <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
          {!status?.supportsImageEdit ? (
            <p className="mb-2 text-xs text-amber-200/90">
              Follow-up edits need Gemini or OpenAI. You can still download and use the Design tab.
            </p>
          ) : null}
          <div className="flex items-end gap-2 rounded-2xl bg-muted/40 p-2 ring-1 ring-border/50">
            <Textarea
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              placeholder="Describe changes… e.g. darker background, add gold frame, more contrast on the face"
              rows={3}
              disabled={busy || !latestImageUrl}
              className="max-h-40 min-h-[4.5rem] flex-1 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  sendFollowUp();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl"
              disabled={busy || !followUpInput.trim() || !latestImageUrl}
              onClick={sendFollowUp}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Ctrl+Enter to send · square output, no title text on image</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h2 className="font-heading text-lg font-semibold">AI album cover</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Write or paste a full generation prompt, then refine the result in a chat-style session.
          </p>
        </div>
      </div>

      {!status?.configured ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          AI covers need <strong className="font-semibold">GEMINI_API_KEY</strong> in Supabase Edge secrets. You can still
          use the Design editor tab.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="cover-title">Album / single title</Label>
        <Input
          id="cover-title"
          value={albumTitle}
          onChange={(e) => setAlbumTitle(e.target.value)}
          placeholder="Midnight Drive"
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">Used as context for the AI — typography goes in the Design tab.</p>
      </div>

      <div className="space-y-2">
        <Label>Optional starting photo</Label>
        <div
          className={cn(
            "relative flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center"
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onPickFile(e.dataTransfer.files?.[0]);
          }}
        >
          {composeReferencePreview ? (
            <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:items-start">
              <ArtworkImage
                src={composeReferencePreview}
                alt="Reference"
                className="h-20 w-20 shrink-0"
                rounded="rounded-lg"
              />
              <p className="min-w-0 flex-1 text-left text-sm text-muted-foreground">
                First generation will edit from this photo. Remove to start from text only.
              </p>
              <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={clearComposeReference}>
                <X className="h-4 w-4" />
                <span className="sr-only">Remove reference</span>
              </Button>
            </div>
          ) : (
            <>
              <ImagePlus className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drop a photo or upload (optional)</p>
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cover-compose-prompt" className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-muted-foreground" />
          Generation prompt
        </Label>
        <Textarea
          id="cover-compose-prompt"
          value={composePrompt}
          onChange={(e) => setComposePrompt(e.target.value)}
          placeholder={`Paste or write your full visual brief…

Example:
Cinematic square album cover, late-night R&B mood. Deep purple and magenta gradient sky, wet asphalt reflecting neon signs, lone figure in silhouette from behind, soft film grain, high detail, no text or logos on the image.`}
          rows={14}
          className="min-h-[280px] resize-y rounded-xl font-mono text-sm leading-relaxed md:min-h-[320px]"
        />
      </div>

      <Button
        type="button"
        className="min-h-11 w-full rounded-full sm:w-auto"
        disabled={busy || !status?.configured}
        onClick={startSession}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Generate & open chat
      </Button>
    </div>
  );
}
