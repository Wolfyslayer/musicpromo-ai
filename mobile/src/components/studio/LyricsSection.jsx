import { useState } from "react";
import { Pressable, View } from "react-native";
import { FileText, Mic, Plus, RotateCcw, Scissors, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { buildLyricCues } from "@/services/promoStyles";
import { formatSRTTimestamp, parseSRT } from "@/services/parseSrt";

const round3 = (n) => Number((Math.max(0, Number(n) || 0)).toFixed(3));

function TimeInput({ label, value, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <View className="flex-1 gap-1">
      <Text className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Text>
      <Input
        value={draft}
        onChangeText={setDraft}
        onEndEditing={() => {
          const n = Number(draft.replace(",", "."));
          if (Number.isFinite(n)) onCommit(n);
          else setDraft(String(value));
        }}
        keyboardType="decimal-pad"
        className="h-9 text-sm"
      />
      <Text className="font-mono text-[10px] text-muted-foreground">{formatSRTTimestamp(value)}</Text>
    </View>
  );
}

function CueRow({ index, cue, onText, onStart, onEnd, onRemove }) {
  return (
    <View className="gap-2 rounded-xl border border-border/40 bg-background/40 p-3">
      <View className="flex-row items-center gap-2">
        <Text className="w-6 text-xs text-muted-foreground">{index + 1}</Text>
        <Input value={cue.text} onChangeText={onText} className="h-9 flex-1 text-sm" />
        <Pressable onPress={onRemove} accessibilityLabel={`Remove line ${index + 1}`} className="h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon as={Trash2} size={14} className="text-muted-foreground" />
        </Pressable>
      </View>
      <View className="flex-row gap-2 pl-8">
        <TimeInput key={`s-${cue.start}`} label="Start (s)" value={cue.start} onCommit={onStart} />
        <TimeInput key={`e-${cue.end}`} label="End (s)" value={cue.end} onCommit={onEnd} />
      </View>
    </View>
  );
}

export default function LyricsSection({ lyrics, cues, duration, syncFocus, currentTime, canTap, onChange }) {
  const { toast } = useToast();
  const [srtText, setSrtText] = useState("");
  const [stampIndex, setStampIndex] = useState(0);

  const emit = (nextCues, nextLyrics = lyrics) => onChange({ lyric_cues: nextCues, lyrics: nextLyrics });
  const joined = (list) => list.map((c) => c.text).join("\n");

  const rebuildFromText = () => {
    setStampIndex(0);
    emit(buildLyricCues(lyrics, duration, []));
  };

  const resetTimes = () => {
    setStampIndex(0);
    emit(buildLyricCues(joined(cues), duration, []));
  };

  const importSrt = () => {
    const parsed = parseSRT(srtText);
    if (!parsed.length) {
      toast({
        variant: "destructive",
        title: "No lyric lines found",
        description: "That SRT text did not contain any timed subtitle lines.",
      });
      return;
    }
    const nextLyrics = joined(parsed);
    setStampIndex(0);
    setSrtText("");
    emit(buildLyricCues(nextLyrics, duration, parsed), nextLyrics);
    toast({ title: `Imported ${parsed.length} ${parsed.length === 1 ? "line" : "lines"} from SRT file!` });
  };

  const updateCue = (index, patch) => {
    const next = cues.map((c, i) => (i === index ? { ...c, ...patch } : c));
    emit(next, patch.text !== undefined ? joined(next) : lyrics);
  };

  const updateStart = (index, value) => {
    const cue = cues[index];
    const start = round3(value);
    const end = round3(Math.max(start, (Number(cue.end) || start) + (start - (Number(cue.start) || 0))));
    updateCue(index, { start, timeSeconds: start, end });
  };

  const updateEnd = (index, value) => {
    const cue = cues[index];
    updateCue(index, { end: round3(Math.max(Number(cue.start) || 0, value)) });
  };

  const removeCue = (index) => {
    const next = cues.filter((_, i) => i !== index);
    setStampIndex((i) => Math.min(i, next.length));
    emit(next, joined(next));
  };

  const addCue = () => {
    const last = cues[cues.length - 1];
    const start = round3(last ? last.end : 0);
    emit([...cues, { text: "New line", start, end: round3(start + 2), timeSeconds: start }]);
  };

  const stampNext = () => {
    if (stampIndex >= cues.length) return;
    const t = round3(currentTime);
    emit(cues.map((c, i) => (i === stampIndex ? { ...c, timeSeconds: t } : c)));
    setStampIndex(stampIndex + 1);
  };

  return (
    <Card className="gap-4">
      <Text className="font-heading text-base">Lyrics</Text>
      <Field label="Lyrics">
        <Textarea
          value={lyrics || ""}
          onChangeText={(v) => onChange({ lyrics: v })}
          placeholder="One lyric line per row…"
          className="min-h-32"
        />
      </Field>
      {syncFocus ? (
        <Text className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
          Full lyrics video. Lines cover the whole song. The 3-second promo intro stays off.
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={Scissors} className="rounded-full" onPress={rebuildFromText}>
          Split into cues
        </Button>
        <Button size="sm" variant="ghost" icon={RotateCcw} className="rounded-full" onPress={resetTimes}>
          Even spacing
        </Button>
      </View>

      <Field label="Import SRT" hint="Paste the contents of a .srt subtitle file to replace the lines and timings.">
        <Textarea
          value={srtText}
          onChangeText={setSrtText}
          placeholder={"1\n00:00:01,000 --> 00:00:03,500\nFirst line"}
          autoCapitalize="none"
          autoCorrect={false}
          className="min-h-24 font-mono text-xs"
        />
      </Field>
      <Button size="sm" variant="outline" icon={FileText} className="self-start rounded-full" disabled={!srtText.trim()} onPress={importSrt}>
        Import SRT
      </Button>

      <View className="gap-2 rounded-xl border border-border/50 bg-card/40 p-3">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-sm font-600">Tapping tool</Text>
          <Text className="text-[11px] text-muted-foreground">
            {Math.min(stampIndex, cues.length)} / {cues.length} stamped
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">Play the preview, then tap to stamp the next line at the current time.</Text>
        {canTap ? null : <Text className="text-xs text-amber-600">Audio URL missing — upload song audio to enable tapping.</Text>}
        <Button size="sm" icon={Mic} className="self-start rounded-full" disabled={!canTap || stampIndex >= cues.length} onPress={stampNext}>
          Tap timestamp
        </Button>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-600">Timeline</Text>
          <Pressable onPress={addCue} className="flex-row items-center gap-1">
            <Icon as={Plus} size={14} className="text-primary" />
            <Text className="text-xs font-600 text-primary">Add line</Text>
          </Pressable>
        </View>
        {!cues.length ? (
          <Text className="text-xs text-muted-foreground">Add lyrics and split into cues to edit timing.</Text>
        ) : (
          cues.map((cue, index) => (
            <CueRow
              key={`cue-${index}`}
              index={index}
              cue={cue}
              onText={(text) => updateCue(index, { text })}
              onStart={(value) => updateStart(index, value)}
              onEnd={(value) => updateEnd(index, value)}
              onRemove={() => removeCue(index)}
            />
          ))
        )}
      </View>
    </Card>
  );
}
