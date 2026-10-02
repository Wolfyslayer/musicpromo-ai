import * as DocumentPicker from 'expo-document-picker';
import { RotateCcw, Sparkles, Upload } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { buildLyricCues } from '@/remotion/styles';
import { syncLyricsFromAudio } from '@/services/lyricsSync';
import { formatSRTTimestamp, parseSRT } from '@/services/parseSrt';

type Cue = { text: string; start?: number; end?: number; timeSeconds?: number };

const NUDGES = [-1, -0.1, 0.1, 1];

/** Lyric cue editor: paste lyrics, import an SRT, auto-sync on your device, then fine-tune each line with +/- nudges. */
export default function LyricsTimelineEditor({
  lyrics = '',
  cues = [],
  duration = 15,
  audioUrl = '',
  audioFile = null,
  onChange,
  onSynced,
  onRequireAuth,
  syncFocus = false,
}: {
  lyrics?: string;
  cues?: Cue[];
  duration?: number;
  audioUrl?: string;
  audioFile?: { uri: string; name?: string; type?: string } | null;
  onChange?: (value: { lyric_cues: Cue[]; lyrics: string }) => void;
  onSynced?: (value: { lyricCues: Cue[]; lyrics: string }) => Promise<void> | void;
  onRequireAuth?: (cb: () => void) => void;
  syncFocus?: boolean;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [draftLyrics, setDraftLyrics] = useState(lyrics || '');
  const [localCues, setLocalCues] = useState<Cue[]>(() => buildLyricCues(lyrics, duration, cues));
  const hasAudio = Boolean(audioUrl || audioFile?.uri);

  useEffect(() => {
    setDraftLyrics(lyrics || '');
  }, [lyrics]);

  useEffect(() => {
    setLocalCues(buildLyricCues(lyrics, duration, cues));
  }, [lyrics, duration, cues]);

  const emit = useCallback(
    (nextCues: Cue[], nextLyrics = draftLyrics) => {
      setLocalCues(nextCues);
      onChange?.({ lyric_cues: nextCues, lyrics: nextLyrics });
    },
    [draftLyrics, onChange]
  );

  const rebuildFromText = () => emit(buildLyricCues(draftLyrics, duration, []), draftLyrics);

  const resetTimes = () => emit(buildLyricCues(localCues.map((c) => c.text).join('\n'), duration, []));

  const timelineMax = Math.max(
    1,
    Number(duration) || 0,
    ...localCues.map((cue) => Math.max(Number(cue.timeSeconds) || 0, Number(cue.start) || 0, Number(cue.end) || 0))
  );

  const updateCueTime = (index: number, timeSeconds: number) => {
    const nextTime = Math.max(0, Math.min(timelineMax, timeSeconds));
    const next = localCues.map((c, i) => {
      if (i !== index) return c;
      const prev = Number(c.timeSeconds ?? c.start) || 0;
      const prevEnd = Number(c.end);
      const end = Number.isFinite(prevEnd) ? Math.max(nextTime, prevEnd + (nextTime - prev)) : nextTime;
      const rounded = Number(nextTime.toFixed(3));
      return { ...c, timeSeconds: rounded, start: rounded, end: Number(end.toFixed(3)) };
    });
    emit(next);
  };

  const updateCueText = (index: number, text: string) => {
    const next = localCues.map((c, i) => (i === index ? { ...c, text } : c));
    emit(next, next.map((c) => c.text).join('\n'));
  };

  const applyImportedCues = (parsed: Cue[]) => {
    const nextLyrics = parsed.map((cue) => cue.text).join('\n');
    setDraftLyrics(nextLyrics);
    setSyncError('');
    emit(buildLyricCues(nextLyrics, duration, parsed), nextLyrics);
  };

  const importSrt = async () => {
    if (syncing) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      if (!/\.srt$/i.test(file.name || '')) {
        toast({ variant: 'destructive', title: 'Choose a .srt file', description: 'Subtitle imports use the standard SRT format.' });
        return;
      }
      const content = await (await fetch(file.uri)).text();
      const parsed = parseSRT(content);
      if (!parsed.length) {
        toast({ variant: 'destructive', title: 'No lyric lines found', description: 'That SRT file did not contain any timed subtitle text.' });
        return;
      }
      applyImportedCues(parsed);
      toast({ title: `Imported ${parsed.length} ${parsed.length === 1 ? 'line' : 'lines'} from SRT file` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not import SRT', description: err?.message || 'That subtitle file could not be read.' });
    }
  };

  const autoSync = async () => {
    if (!hasAudio || syncing) return;
    setSyncing(true);
    setSyncError('');
    setSyncProgress(2);
    try {
      const synced = await syncLyricsFromAudio({
        audioUrl,
        audioFile,
        durationSec: duration,
        onProgress: (info: { progress?: number }) => {
          if (typeof info.progress === 'number') setSyncProgress(Math.max(0, Math.min(100, info.progress)));
        },
      });
      if (!synced.length) {
        setSyncError('No lyrics detected in this clip. Type the lines or import an SRT file.');
        return;
      }
      const nextLyrics = synced.map((cue: Cue) => cue.text).join('\n');
      setDraftLyrics(nextLyrics);
      emit(synced, nextLyrics);
      if (typeof onSynced === 'function') await onSynced({ lyricCues: synced, lyrics: nextLyrics });
    } catch (err: any) {
      setSyncError(err?.message || 'Lyrics sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View className="gap-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
      <View>
        <Label className="text-xs text-muted-foreground">Lyrics</Label>
        <Textarea
          value={draftLyrics}
          onChangeText={setDraftLyrics}
          editable={!syncing}
          placeholder="One lyric line per row…"
          className="min-h-32 rounded-xl"
        />
        {syncFocus ? (
          <Text className="mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
            Full lyrics video. Auto-sync lines the whole song. The 3-second promo intro stays off.
          </Text>
        ) : null}
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!hasAudio || syncing}
            onPress={() => (typeof onRequireAuth === 'function' ? onRequireAuth(autoSync) : autoSync())}>
            <Icon as={Sparkles} size={14} />
            <Text className="text-xs font-medium">Auto-Sync with AI</Text>
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={syncing} onPress={importSrt}>
            <Icon as={Upload} size={14} />
            <Text className="text-xs font-medium">Import .srt</Text>
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={syncing} onPress={rebuildFromText}>
            Split into cues
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" disabled={syncing} onPress={resetTimes}>
            <Icon as={RotateCcw} size={14} />
            <Text className="text-xs font-medium">Even spacing</Text>
          </Button>
        </View>
        {syncing ? (
          <View className="mt-3 gap-2">
            <Text className="text-xs text-muted-foreground">AI is listening and syncing your lyrics...</Text>
            <Progress value={syncProgress} />
          </View>
        ) : null}
        {syncError ? <Text className="mt-2 text-xs text-amber-600">{syncError}</Text> : null}
      </View>

      <View className="gap-2 rounded-xl border border-border/50 bg-card/40 p-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold">Timeline</Text>
          <Text className="text-xs text-muted-foreground">
            {localCues.length} {localCues.length === 1 ? 'cue' : 'cues'}
          </Text>
        </View>
        {localCues.length === 0 ? (
          <Text className="py-3 text-center text-xs text-muted-foreground">Add lyrics above, then tap Split into cues.</Text>
        ) : (
          localCues.map((cue, index) => {
            const start = Number(cue.timeSeconds ?? cue.start) || 0;
            return (
              <View key={index} className="gap-2 border-t border-border/40 pt-2">
                <View className="flex-row items-center gap-2">
                  <Text className="w-5 text-xs text-muted-foreground">{index + 1}</Text>
                  <TextInput
                    value={cue.text}
                    onChangeText={(text) => updateCueText(index, text)}
                    className="h-10 flex-1 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                  />
                </View>
                <View className="flex-row items-center justify-between gap-2 pl-7">
                  <Text className="text-[11px] text-muted-foreground">{formatSRTTimestamp(start)}</Text>
                  <View className="flex-row gap-1.5">
                    {NUDGES.map((delta) => (
                      <Pressable
                        key={delta}
                        accessibilityLabel={`Shift line ${index + 1} by ${delta} seconds`}
                        onPress={() => updateCueTime(index, start + delta)}
                        className="h-9 min-w-12 items-center justify-center rounded-lg border border-border bg-muted px-2 active:opacity-70">
                        <Text className="text-xs font-semibold">{delta > 0 ? `+${delta}` : delta}s</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
