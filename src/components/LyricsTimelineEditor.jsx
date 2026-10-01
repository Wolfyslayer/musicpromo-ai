import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { syncLyricsFromAudio } from "@/services/lyricsSync";
import { formatSRTTimestamp, parseSRT } from "@/services/parseSrt";
import { buildLyricCues } from "@/remotion/styles";

/**
 * Interactive lyrics cue editor: tap-to-timestamp + fine-tune timeline.
 */
export default function LyricsTimelineEditor({
  lyrics = "",
  cues = [],
  duration = 15,
  audioUrl = "",
  audioFile = null,
  onChange,
  onSynced,
  onRequireAuth,
  syncFocus = false,
}) {
  const audioRef = useRef(null);
  const srtInputRef = useRef(null);
  const { toast } = useToast();
  const [stampIndex, setStampIndex] = useState(0);
  const [srtDragOver, setSrtDragOver] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncError, setSyncError] = useState("");
  const [draftLyrics, setDraftLyrics] = useState(lyrics || "");
  const [localCues, setLocalCues] = useState(() =>
    buildLyricCues(lyrics, duration, cues)
  );

  useEffect(() => {
    setDraftLyrics(lyrics || "");
  }, [lyrics]);

  useEffect(() => {
    setLocalCues(buildLyricCues(lyrics, duration, cues));
  }, [lyrics, duration, cues]);

  const emit = useCallback(
    (nextCues, nextLyrics = draftLyrics) => {
      setLocalCues(nextCues);
      onChange?.({
        lyric_cues: nextCues,
        lyrics: nextLyrics,
      });
    },
    [draftLyrics, onChange]
  );

  const rebuildFromText = () => {
    const next = buildLyricCues(draftLyrics, duration, []);
    setStampIndex(0);
    emit(next, draftLyrics);
  };

  const resetTimes = () => {
    const lines = localCues.map((c) => c.text);
    const next = buildLyricCues(lines.join("\n"), duration, []);
    setStampIndex(0);
    emit(next);
  };

  const timelineMax = Math.max(
    1,
    Number(duration) || 0,
    ...localCues.map((cue) =>
      Math.max(Number(cue.timeSeconds) || 0, Number(cue.start) || 0, Number(cue.end) || 0)
    )
  );

  const updateCueTime = (index, timeSeconds) => {
    const nextTime = Math.max(0, Math.min(timelineMax, Number(timeSeconds) || 0));
    const next = localCues.map((c, i) => {
      if (i !== index) return c;
      const prev = Number(c.timeSeconds) || 0;
      const delta = nextTime - prev;
      const prevEnd = Number(c.end);
      const end = Number.isFinite(prevEnd) ? Math.max(nextTime, prevEnd + delta) : nextTime;
      const rounded = Number(nextTime.toFixed(3));
      return {
        ...c,
        timeSeconds: rounded,
        start: rounded,
        end: Number(end.toFixed(3)),
      };
    });
    emit(next);
  };

  const applyImportedCues = (parsed) => {
    const nextLyrics = parsed.map((cue) => cue.text).join("\n");
    const nextCues = buildLyricCues(nextLyrics, duration, parsed);
    setDraftLyrics(nextLyrics);
    setStampIndex(0);
    setSyncError("");
    emit(nextCues, nextLyrics);
  };

  const readSrtFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Could not read that SRT file."));
      reader.readAsText(file);
    });

  const importSrtFile = async (file) => {
    if (!file || syncing) return;
    if (!/\.srt$/i.test(file.name || "")) {
      toast({
        variant: "destructive",
        title: "Upload a .srt file",
        description: "Subtitle imports use the standard SRT format.",
      });
      return;
    }
    try {
      const content = await readSrtFile(file);
      const parsed = parseSRT(content);
      if (!parsed.length) {
        toast({
          variant: "destructive",
          title: "No lyric lines found",
          description: "That SRT file did not contain any timed subtitle text.",
        });
        return;
      }
      applyImportedCues(parsed);
      const count = parsed.length;
      toast({
        title: `Imported ${count} ${count === 1 ? "line" : "lines"} from SRT file!`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not import SRT",
        description: err?.message || "That subtitle file could not be read.",
      });
    } finally {
      if (srtInputRef.current) srtInputRef.current.value = "";
    }
  };

  const autoSync = async () => {
    if ((!audioUrl && !(audioFile instanceof Blob)) || syncing) return;
    setSyncing(true);
    setSyncError("");
    setSyncProgress(2);
    try {
      const cues = await syncLyricsFromAudio({
        audioUrl,
        audioFile,
        durationSec: duration,
        onProgress: (info) => {
          if (typeof info.progress === "number") {
            setSyncProgress(Math.max(0, Math.min(100, info.progress)));
          }
        },
      });
      if (!cues.length) {
        setSyncError("No lyrics detected in this clip. Type lines or use the tap tool.");
        return;
      }
      const nextLyrics = cues.map((cue) => cue.text).join("\n");
      setDraftLyrics(nextLyrics);
      setStampIndex(0);
      emit(cues, nextLyrics);
      if (typeof onSynced === "function") await onSynced({ lyricCues: cues, lyrics: nextLyrics });
    } catch (err) {
      setSyncError(err?.message || "Lyrics sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const updateCueText = (index, text) => {
    const next = localCues.map((c, i) => (i === index ? { ...c, text } : c));
    emit(next, next.map((c) => c.text).join("\n"));
  };

  const stampNext = useCallback(() => {
    const el = audioRef.current;
    const t = el ? el.currentTime : 0;
    setStampIndex((idx) => {
      if (idx >= localCues.length) return idx;
      const next = localCues.map((c, i) =>
        i === idx ? { ...c, timeSeconds: Number(t.toFixed(3)) } : c
      );
      emit(next);
      return idx + 1;
    });
  }, [emit, localCues]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "Space") return;
      const tag = String(e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      e.preventDefault();
      stampNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stampNext]);

  const progressLabel = `${Math.min(stampIndex, localCues.length)} / ${localCues.length} stamped`;

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
      <div>
        <Label className="text-xs text-muted-foreground">Lyrics</Label>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-[1fr_168px]">
          <Textarea
            value={draftLyrics}
            onChange={(e) => setDraftLyrics(e.target.value)}
            rows={5}
            className="rounded-xl"
            placeholder="One lyric line per row…"
            disabled={syncing}
          />
          <label
            onDragOver={(event) => {
              event.preventDefault();
              if (!syncing) setSrtDragOver(true);
            }}
            onDragLeave={() => setSrtDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setSrtDragOver(false);
              const file = event.dataTransfer?.files?.[0];
              if (file) importSrtFile(file);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground transition ${
              srtDragOver ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/40"
            } ${syncing ? "pointer-events-none opacity-60" : ""}`}
          >
            <Upload className="h-4 w-4" />
            Upload .srt file
            <input
              ref={srtInputRef}
              type="file"
              accept=".srt,text/plain,application/x-subrip"
              className="sr-only"
              disabled={syncing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importSrtFile(file);
              }}
            />
          </label>
        </div>
        {syncFocus ? (
          <p className="mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
            Full lyrics video. Auto-sync lines the whole song. The 3-second promo intro stays off.
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={(!audioUrl && !(audioFile instanceof Blob)) || syncing}
            onClick={() => {
              if (typeof onRequireAuth === "function") onRequireAuth(autoSync);
              else autoSync();
            }}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Auto-Sync Lyrics with AI
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={rebuildFromText} disabled={syncing}>
            Split into cues
          </Button>
          <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={resetTimes} disabled={syncing}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Even spacing
          </Button>
        </div>
        {syncing ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">AI is listening and syncing your lyrics...</p>
            <Progress value={syncProgress} />
          </div>
        ) : null}
        {syncError ? <p className="mt-2 text-xs text-amber-600">{syncError}</p> : null}
      </div>

      <div className="space-y-2 rounded-xl border border-border/50 bg-card/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-600">Tapping tool</p>
          <span className="text-[11px] text-muted-foreground">{progressLabel}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Play the track, then hit <kbd className="rounded bg-muted px-1">Space</kbd> or Tap to stamp the next line.
        </p>
        {audioUrl ? (
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="mt-1 w-full"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <p className="text-xs text-amber-600">Audio URL missing — upload song audio to enable tapping.</p>
        )}
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          disabled={!audioUrl || stampIndex >= localCues.length}
          onClick={stampNext}
        >
          <Mic className="mr-1.5 h-3.5 w-3.5" />
          {playing ? "Tap now" : "Tap timestamp"}
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-600">Timeline</p>
        {!localCues.length ? (
          <p className="text-xs text-muted-foreground">Add lyrics and split into cues to edit timing.</p>
        ) : (
          localCues.map((cue, index) => (
            <div
              key={`cue-${index}`}
              className="space-y-2 rounded-xl border border-border/40 bg-background/40 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                <Input
                  value={cue.text}
                  onChange={(e) => updateCueText(index, e.target.value)}
                  className="rounded-lg"
                />
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  max={timelineMax}
                  value={cue.timeSeconds}
                  onChange={(e) => updateCueTime(index, e.target.value)}
                  className="w-24 rounded-lg"
                />
                <span className="w-[6.75rem] shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                  {formatSRTTimestamp(cue.timeSeconds)}
                </span>
              </div>
              <Slider
                value={[Math.min(timelineMax, Math.max(0, Number(cue.timeSeconds) || 0))]}
                min={0}
                max={timelineMax}
                step={0.001}
                onValueChange={(v) => updateCueTime(index, v[0])}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
