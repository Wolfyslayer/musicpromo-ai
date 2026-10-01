import { useRef, useState } from "react";
import { ImagePlus, RefreshCw, X, Loader2 } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import ArtworkImage from "./ArtworkImage";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

/**
 * Artwork uploader. Album art goes to the public music-promo-assets bucket
 * and the returned URL is passed into analysis and the Remotion preview.
 *
 * onChange(url) or onChange({ url, file }) when the parent wants the local File
 * for client-side Remotion rendering.
 */
export default function ArtworkUpload({ value, onChange, guard }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const openPicker = () => {
    const open = () => inputRef.current?.click();
    if (typeof guard === "function") guard(open);
    else open();
  };

  const emit = (url, file) => {
    if (typeof onChange !== "function") return;
    // CreateCampaign expects { url, file }; ReleaseEditor and others still pass a string setter.
    onChange({ url: url || "", file: file || null });
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast({ variant: "destructive", title: "Unsupported file", description: "Use JPG, PNG or WEBP." });
      return;
    }
    setBusy(true);
    try {
      if (!supabase) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to upload.");
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) throw new Error("Sign in to upload artwork.");
      const safeName = String(file.name || "artwork").replace(/[^\w.\-]+/g, "_");
      const path = `${auth.user.id}/artwork/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("music-promo-assets").upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("music-promo-assets").getPublicUrl(path);
      emit(data.publicUrl, file);
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
              onClick={openPicker}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-xs font-500 text-white backdrop-blur hover:bg-white/25"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Replace
            </button>
            <button
              type="button"
              onClick={() => emit("", null)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-xs font-500 text-white backdrop-blur hover:bg-white/25"
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
          onClick={openPicker}
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
