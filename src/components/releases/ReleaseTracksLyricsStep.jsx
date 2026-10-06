import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Loader2, Upload } from "lucide-react";
import { db } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import WizardStepIntro from "@/components/ux/WizardStepIntro";
import { parseSRT } from "@/services/parseSrt";

function TrackLyricsRow({ song, expanded, onToggle, onSaved }) {
  const { toast } = useToast();
  const srtRef = useRef(null);
  const [lyrics, setLyrics] = useState(song.lyrics || "");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setLyrics(song.lyrics || "");
  }, [song.id, song.lyrics]);

  const saveLyrics = async (nextText) => {
    setSaving(true);
    try {
      await db.entities.Song.update(song.id, { lyrics: (nextText ?? lyrics).trim() });
      toast({ title: "Lyrics saved", description: song.title });
      onSaved?.();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save lyrics", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const importSrt = async (file) => {
    if (!file) return;
    if (!/\.srt$/i.test(file.name || "")) {
      toast({
        variant: "destructive",
        title: "Use a .srt file",
        description: "Standard subtitle format with timed lines.",
      });
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const cues = parseSRT(text);
      if (!cues.length) {
        toast({ variant: "destructive", title: "No lines in SRT", description: "Check the file format." });
        return;
      }
      const joined = cues.map((c) => c.text).join("\n");
      setLyrics(joined);
      await saveLyrics(joined);
      toast({ title: "SRT imported", description: `${cues.length} lines added for ${song.title}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Import failed", description: e.message });
    } finally {
      setImporting(false);
      if (srtRef.current) srtRef.current.value = "";
    }
  };

  const hasLyrics = Boolean(String(song.lyrics || lyrics).trim());

  return (
    <li className={`rounded-2xl border p-3 transition ${expanded ? "border-primary/35 bg-primary/[0.04]" : "border-border/60"}`}>
      <button type="button" className="flex w-full items-center gap-3 text-left" onClick={onToggle}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
          {song.track_number || "·"}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{song.title}</span>
        {hasLyrics ? (
          <span className="inline-flex items-center gap-1 text-xs text-primary">
            <Check className="h-3.5 w-3.5" /> Added
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Optional</span>
        )}
      </button>

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-border/40 pt-4">
          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) importSrt(file);
            }}
          >
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Drop a .srt file</p>
            <p className="mt-1 text-xs text-muted-foreground">Or paste lyrics below — helps AI pick the best hook clip.</p>
            <input
              ref={srtRef}
              type="file"
              accept=".srt,text/plain"
              className="hidden"
              onChange={(e) => importSrt(e.target.files?.[0])}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 rounded-full"
              disabled={importing}
              onClick={() => srtRef.current?.click()}
            >
              {importing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
              Choose SRT
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Lyrics text</Label>
            <Textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={5}
              className="rounded-xl font-mono text-sm"
              placeholder="Paste lyrics line by line…"
            />
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={saving}
              onClick={() => saveLyrics()}
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save for this track
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default function ReleaseTracksLyricsStep({ songs, onSaved }) {
  const [openId, setOpenId] = useState(songs[0]?.id || "");
  const withLyrics = useMemo(
    () => songs.filter((s) => String(s.lyrics || "").trim()).length,
    [songs]
  );

  if (!songs.length) {
    return (
      <p className="text-sm text-muted-foreground">Add tracks on the release step first.</p>
    );
  }

  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Lyrics & subtitles"
        description="Optional — skip if you want. Lyrics and SRT files help AI find the strongest part of each track for promo clips."
        optionalHint={withLyrics ? `${withLyrics} of ${songs.length} tracks have lyrics` : "You can continue without adding any"}
      />
      <ul className="space-y-2">
        {songs.map((s) => (
          <TrackLyricsRow
            key={s.id}
            song={s}
            expanded={openId === s.id}
            onToggle={() => setOpenId((id) => (id === s.id ? "" : s.id))}
            onSaved={onSaved}
          />
        ))}
      </ul>
    </div>
  );
}
