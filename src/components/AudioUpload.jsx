import { useEffect, useRef, useState } from "react";
import { audioDisplayName } from "@/services/audioDisplay";
import { Upload, X, Loader2, Music, RefreshCw } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { fmtDuration } from "@/services/format";
import { supabase } from "@/lib/supabaseClient";

const ACCEPT = ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/mp4";

/**
 * Audio uploader. The track is stored in the public music-promo-assets bucket.
 * The public URL is what audio analysis, Whisper, and Remotion play.
 *
 * onChange({ file_uri, signed_url, duration, name, file })
 * `file` is the local Blob kept for client-side Remotion rendering.
 */
export default function AudioUpload({ value, signedUrl, fileName = "", durationSec = null, onChange, guard }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(durationSec);
  const [playUrl, setPlayUrl] = useState(signedUrl || value || "");
  const { toast } = useToast();

  useEffect(() => {
    if (!value) {
      setPlayUrl("");
      setName("");
      setDuration(null);
      return;
    }
    setPlayUrl(signedUrl || value);
    setName(fileName || audioDisplayName({ audioFilename: fileName, audioUrl: value }));
    if (durationSec != null) setDuration(durationSec);
  }, [value, signedUrl, fileName, durationSec]);

  const openPicker = () => {
    const open = () => inputRef.current?.click();
    if (typeof guard === "function") guard(open);
    else open();
  };

  const handleFile = async (file) => {
    if (!file) return;
    const ok = /\.(mp3|wav|m4a)$/i.test(file.name) || /^audio\/(mpeg|wav|x-wav|mp4)$/i.test(file.type);
    if (!ok) {
      toast({ variant: "destructive", title: "Unsupported file", description: "Use MP3, WAV or M4A." });
      return;
    }
    setBusy(true);
    try {
      if (!supabase) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to upload.");
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) throw new Error("Sign in to upload audio.");
      const safeName = String(file.name || "audio").replace(/[^\w.\-]+/g, "_");
      const path = `${auth.user.id}/audio/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("music-promo-assets").upload(path, file, {
        contentType: file.type || "audio/wav",
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("music-promo-assets").getPublicUrl(path);
      const file_uri = data.publicUrl;
      const signed_url = data.publicUrl;
      setName(file.name);
      setPlayUrl(signed_url);
      // measure duration
      const audio = new Audio(signed_url);
      audio.onloadedmetadata = () => {
        const d = isFinite(audio.duration) ? audio.duration : null;
        setDuration(d);
        onChange({ file_uri, signed_url, duration: d, name: file.name, file });
      };
      audio.onerror = () => {
        setDuration(null);
        onChange({ file_uri, signed_url, duration: null, name: file.name, file });
      };
      onChange({ file_uri, signed_url, duration: null, name: file.name, file });
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
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Music className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-600">{name || "Audio file"}</p>
              <p className="text-xs text-muted-foreground">
                {duration ? `${fmtDuration(duration)} · ` : ""}MP3/WAV/M4A · ready for the studio
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openPicker}
                disabled={busy}
                className="grid h-11 w-11 place-items-center rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Replace audio"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => { onChange({ file_uri: "", signed_url: "", duration: null, name: "", file: null }); setPlayUrl(""); setName(""); setDuration(null); }}
                className="grid h-11 w-11 place-items-center rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Remove audio"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {playUrl && (
            <audio controls src={playUrl} className="mt-3 w-full" style={{ colorScheme: "dark" }} />
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 px-6 py-10 text-muted-foreground transition hover:border-primary/50 hover:text-primary"
        >
          {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <Upload className="h-8 w-8" />}
          <span className="text-sm font-500">{busy ? "Uploading…" : "Upload song"}</span>
          <span className="text-xs text-muted-foreground/70">MP3 · WAV · M4A — stored privately</span>
        </button>
      )}
    </div>
  );
}
