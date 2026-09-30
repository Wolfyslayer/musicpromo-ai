import { db } from '@/api/base44Client';

import { useRef, useState } from "react";
import { ImagePlus, RefreshCw, X, Loader2 } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import ArtworkImage from "./ArtworkImage";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

/**
 * Artwork uploader. Artwork is promotional album art that is displayed
 * throughout the app and used in exported promo content, so it is stored
 * PUBLICLY (permanent URL) via UploadPublicFile.
 */
export default function ArtworkUpload({ value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast({ variant: "destructive", title: "Unsupported file", description: "Use JPG, PNG or WEBP." });
      return;
    }
    setBusy(true);
    try {
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
      onChange(file_url);
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl border border-border/70 shadow-2xl shadow-black/40">
          <ArtworkImage src={value} alt="Artwork preview" className="h-full w-full" rounded="rounded-3xl" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-500 text-white backdrop-blur hover:bg-white/25"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Replace
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-500 text-white backdrop-blur hover:bg-white/25"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-black/50">
              <Loader2 className="h-7 w-7 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mx-auto flex aspect-square w-full max-w-xs flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border/70 bg-muted/30 text-muted-foreground transition hover:border-primary/50 hover:text-primary"
        >
          {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <ImagePlus className="h-8 w-8" />}
          <span className="text-sm font-500">Upload artwork</span>
          <span className="text-xs text-muted-foreground/70">JPG · PNG · WEBP</span>
        </button>
      )}
    </div>
  );
}
