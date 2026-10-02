import Slider from '@react-native-community/slider';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { Mic } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/lib/toast';
import { buildLyricCues } from '@/lib/promoStyles';
import { parseSRT } from '@/services/parseSrt';
import { syncLyricsFromAudio } from '@/services/lyricsSync';

type Cue = { text: string; start?: number; end?: number; timeSeconds?: number };

type Props = {
  lyrics?: string;
  cues?: Cue[];
  duration?: number;
  audioUrl?: string;
  audioFile?: Blob | null;
  onChange?: (payload: { lyric_cues: Cue[]; lyrics: string }) => void;
  onSynced?: (cues: Cue[]) => void;
  onRequireAuth?: () => boolean;
};

export default function LyricsTimelineEditor({
  lyrics = '',
  cues = [],
  duration = 15,
  audioUrl = '',
  onChange,
  onSynced,
  onRequireAuth,
}: Props) {
  const { toast } = useToast();
  const [draftLyrics, setDraftLyrics] = useState(lyrics);
  const [localCues, setLocalCues] = useState<Cue[]>(() => buildLyricCues(lyrics, duration, cues));
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  useEffect(() => setDraftLyrics(lyrics || ''), [lyrics]);
  useEffect(() => setLocalCues(buildLyricCues(lyrics, duration, cues)), [lyrics, duration, cues]);

  const emit = useCallback(
    (nextCues: Cue[], nextLyrics = draftLyrics) => {
      setLocalCues(nextCues);
      onChange?.({ lyric_cues: nextCues, lyrics: nextLyrics });
    },
    [draftLyrics, onChange],
  );

  const rebuildFromText = () => {
    const next = buildLyricCues(draftLyrics, duration, []) as Cue[];
    emit(next, draftLyrics);
  };

  const resetTimes = () => {
    const next = buildLyricCues(draftLyrics, duration, []) as Cue[];
    emit(next);
  };

  const updateCueTime = (index: number, timeSeconds: number) => {
    const next = localCues.map((c, i) => {
      if (i !== index) return c;
      const rounded = Number(Math.max(0, Math.min(duration, timeSeconds)).toFixed(3));
      return { ...c, timeSeconds: rounded, start: rounded, end: rounded };
    });
    emit(next);
  };

  const runSync = async () => {
    if (onRequireAuth && !onRequireAuth()) return;
    setSyncing(true);
    setSyncProgress(0);
    try {
      const synced = await syncLyricsFromAudio({
        audioUrl,
        durationSec: duration,
        onProgress: (p: { progress?: number }) => setSyncProgress(p.progress ?? 0),
      });
      emit(synced as Cue[], synced.map((c: Cue) => c.text).join('\n'));
      setDraftLyrics(synced.map((c: Cue) => c.text).join('\n'));
      onSynced?.(synced as Cue[]);
      toast({ title: 'Lyrics synced' });
    } catch (e) {
      toast({
        title: 'Sync failed',
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSyncing(false);
    }
  };

  const importSrt = async () => {
    const pick = await DocumentPicker.getDocumentAsync({ type: ['text/*', 'application/x-subrip'], copyToCacheDirectory: true });
    if (pick.canceled || !pick.assets[0]?.uri) return;
    const text = await fetch(pick.assets[0].uri).then((r) => r.text());
    const parsed = parseSRT(text);
    if (!parsed.length) {
      toast({ title: 'Invalid SRT', description: 'No cues found in file.' });
      return;
    }
    emit(parsed as Cue[], parsed.map((c) => c.text).join('\n'));
    setDraftLyrics(parsed.map((c) => c.text).join('\n'));
  };

  const previewLine = async (index: number) => {
    if (!audioUrl) return;
    const cue = localCues[index];
    const at = Number(cue?.timeSeconds ?? cue?.start ?? 0);
    const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true, positionMillis: at * 1000 });
    setTimeout(() => sound.unloadAsync(), 4000);
  };

  return (
    <View className="gap-4">
      <Textarea
        label="Lyrics"
        value={draftLyrics}
        onChangeText={(v) => {
          setDraftLyrics(v);
          emit(buildLyricCues(v, duration, []) as Cue[], v);
        }}
        numberOfLines={8}
      />

      <View className="flex-row flex-wrap gap-2">
        <Button variant="outline" label="Rebuild timing" onPress={rebuildFromText} />
        <Button variant="outline" label="Reset times" onPress={resetTimes} />
        <Button variant="outline" label="Import SRT" onPress={importSrt} />
        <Button
          label={syncing ? 'Syncing…' : 'AI sync'}
          onPress={runSync}
          disabled={syncing || !audioUrl}
        />
      </View>

      {syncing ? (
        <View className="gap-2">
          <ActivityIndicator />
          <Text className="text-xs text-muted-foreground">Progress {Math.round(syncProgress)}%</Text>
        </View>
      ) : null}

      <ScrollView className="max-h-80 gap-3">
        {localCues.map((cue, index) => (
          <View key={`${index}-${cue.text}`} className="mb-3 rounded-xl border border-border p-3">
            <Pressable onPress={() => previewLine(index)} className="flex-row items-center gap-2">
              <Mic color="#8b5cf6" size={16} />
              <Text className="flex-1 text-sm text-foreground">{cue.text}</Text>
            </Pressable>
            <Text className="mt-2 text-xs text-muted-foreground">
              {(cue.timeSeconds ?? cue.start ?? 0).toFixed(2)}s
            </Text>
            <Slider
              minimumValue={0}
              maximumValue={Math.max(duration, 1)}
              value={Number(cue.timeSeconds ?? cue.start ?? 0)}
              onSlidingComplete={(v) => updateCueTime(index, v)}
              minimumTrackTintColor="#8b5cf6"
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
