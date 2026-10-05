import { useCallback, useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { ImagePlus, Loader2, Type, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

const EXPORT_SIZE = 3000;
const PREVIEW_SIZE = 420;

function nextId() {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function ArtworkDesignEditor({ seedImageUrl = "", onExportUrl, requireAuth }) {
  const { toast } = useToast();
  const boardRef = useRef(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [bgColor, setBgColor] = useState("#0c0a12");
  const [bgImage, setBgImage] = useState(seedImageUrl || "");
  const [layers, setLayers] = useState(() => [
    {
      id: nextId(),
      type: "text",
      text: "ALBUM TITLE",
      fontSize: 42,
      color: "#ffffff",
      x: 50,
      y: 38,
      align: "center",
    },
    {
      id: nextId(),
      type: "text",
      text: "Artist Name",
      fontSize: 22,
      color: "#e9d5ff",
      x: 50,
      y: 58,
      align: "center",
    },
  ]);

  useEffect(() => {
    if (seedImageUrl) setBgImage(seedImageUrl);
  }, [seedImageUrl]);
  const [activeId, setActiveId] = useState(null);

  const updateLayer = (id, patch) => {
    setLayers((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addTextLayer = () => {
    const id = nextId();
    setLayers((list) => [
      ...list,
      { id, type: "text", text: "New text", fontSize: 28, color: "#ffffff", x: 10, y: 50, align: "left" },
    ]);
    setActiveId(id);
  };

  const onBgFile = (file) => {
    if (!file || !/^image\//.test(file.type)) return;
    const url = URL.createObjectURL(file);
    setBgImage(url);
  };

  const exportPng = useCallback(async () => {
    const run = async () => {
      if (!boardRef.current) return;
      setBusy(true);
      try {
        const scale = EXPORT_SIZE / PREVIEW_SIZE;
        const canvas = await html2canvas(boardRef.current, {
          scale,
          backgroundColor: null,
          useCORS: true,
          logging: false,
        });
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
        if (!blob) throw new Error("Could not render PNG.");

        if (!supabase) throw new Error("Supabase is not configured.");
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth?.user) throw new Error("Sign in to save your cover.");

        const path = `${auth.user.id}/cover-designs/${Date.now()}-cover.png`;
        const { error } = await supabase.storage.from("music-promo-assets").upload(path, blob, {
          contentType: "image/png",
          upsert: false,
        });
        if (error) throw new Error(error.message);
        const { data } = supabase.storage.from("music-promo-assets").getPublicUrl(path);
        const url = data?.publicUrl || "";
        onExportUrl?.(url);
        toast({ title: "Cover exported", description: "3000×3000 PNG saved to your assets." });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "album-cover.png";
        link.click();
      } catch (e) {
        toast({ variant: "destructive", title: "Export failed", description: e.message });
      } finally {
        setBusy(false);
      }
    };
    if (typeof requireAuth === "function") requireAuth(run);
    else run();
  }, [onExportUrl, requireAuth, toast]);

  const active = layers.find((l) => l.id === activeId);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col items-center gap-4">
        <div
          ref={boardRef}
          className="relative overflow-hidden rounded-3xl border border-border/70 shadow-2xl"
          style={{
            width: PREVIEW_SIZE,
            height: PREVIEW_SIZE,
            backgroundColor: bgColor,
            backgroundImage: bgImage ? `url(${bgImage})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {layers.map((layer) =>
            layer.type === "text" ? (
              <div
                key={layer.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveId(layer.id)}
                onKeyDown={(e) => e.key === "Enter" && setActiveId(layer.id)}
                className={cn(
                  "absolute max-w-[84%] cursor-pointer px-2 py-1 font-heading font-bold leading-tight outline-none",
                  activeId === layer.id && "ring-2 ring-primary ring-offset-2 ring-offset-transparent"
                )}
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: layer.fontSize,
                  color: layer.color,
                  textAlign: layer.align,
                  width: layer.align === "center" ? "88%" : "auto",
                }}
              >
                {layer.text}
              </div>
            ) : null
          )}
        </div>
        <p className="max-w-md text-center text-xs text-muted-foreground">
          Tap a text layer to edit. Export produces a {EXPORT_SIZE}×{EXPORT_SIZE} PNG for Spotify / Apple Music specs.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-4">
        <h3 className="font-heading text-base font-semibold">Design tools</h3>

        <div className="space-y-2">
          <Label>Background color</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
            />
            <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="rounded-xl font-mono text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="mr-1.5 h-4 w-4" />
            Background image
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onBgFile(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={addTextLayer}>
            <Type className="mr-1.5 h-4 w-4" />
            Add text
          </Button>
        </div>

        {active?.type === "text" ? (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
            <Label>Selected text</Label>
            <Input value={active.text} onChange={(e) => updateLayer(active.id, { text: e.target.value })} className="rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Size</Label>
                <Input
                  type="number"
                  min={12}
                  max={120}
                  value={active.fontSize}
                  onChange={(e) => updateLayer(active.id, { fontSize: Number(e.target.value) || 24 })}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <input
                  type="color"
                  value={active.color}
                  onChange={(e) => updateLayer(active.id, { color: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-lg border border-border"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">X %</Label>
                <Input
                  type="number"
                  value={active.x}
                  onChange={(e) => updateLayer(active.id, { x: Number(e.target.value) || 0 })}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs">Y %</Label>
                <Input
                  type="number"
                  value={active.y}
                  onChange={(e) => updateLayer(active.id, { y: Number(e.target.value) || 0 })}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a text layer on the canvas to edit font and position.</p>
        )}

        <Button type="button" className="min-h-11 w-full rounded-full" disabled={busy} onClick={exportPng}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Export 3000×3000 PNG
        </Button>
      </div>
    </div>
  );
}
