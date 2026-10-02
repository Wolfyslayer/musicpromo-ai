import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Music, Pause, Play, RefreshCw, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { pickAudio } from '@/lib/pickers';
import { analyzeAudioEnergy } from '@/services/assetAnalysis';
import { fmtDuration } from '@/services/format';
import { uploadPromoAsset } from '@/services/supabaseStore';

function AudioPreview({ url }: { url: string }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const pct = status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;
  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.duration > 0 && status.currentTime >= status.duration - 0.1) player.seekTo(0);
    player.play();
  };
  return (
    <View className="mt-3 flex-row items-center gap-3">
      <Pressable onPress={toggle} accessibilityLabel={status.playing ? 'Pause' : 'Play'} className="size-10 items-center justify-center rounded-full bg-primary">
        <Icon as={status.playing ? Pause : Play} size={16} className="text-primary-foreground" />
      </Pressable>
      <View className="flex-1 gap-1">
        <Progress value={pct} />
        <Text className="text-xs text-muted-foreground">
          {fmtDuration(status.currentTime || 0)} / {status.duration > 0 ? fmtDuration(status.duration) : '--:--'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Audio uploader. The track is stored in the public music-promo-assets bucket.
 * onChange({ file_uri, signed_url, duration, name, file }) where `file` is the picked `{ uri, name, type }`.
 */
export default function AudioUpload({ value, signedUrl, onChange, guard }: { value?: string; signedUrl?: string; onChange?: (payload: any) => void; guard?: (cb: () => void) => void }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [playUrl, setPlayUrl] = useState(signedUrl || '');
  const previewUrl = playUrl || signedUrl || '';

  const handleFile = async () => {
    const file = await pickAudio();
    if (!file) return;
    const ok = /\.(mp3|wav|m4a)$/i.test(file.name) || /^audio\/(mpeg|mp3|wav|x-wav|wave|mp4|x-m4a|m4a)$/i.test(file.type);
    if (!ok) {
      toast({ variant: 'destructive', title: 'Unsupported file', description: 'Use MP3, WAV or M4A.' });
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadPromoAsset(file, 'audio');
      const file_uri = uploaded.publicUrl;
      const signed_url = uploaded.publicUrl;
      if (!file_uri) throw new Error('Upload succeeded but no public URL was returned.');
      setName(file.name);
      setPlayUrl(signed_url);
      setDuration(null);
      onChange?.({ file_uri, signed_url, duration: null, name: file.name, file });
      analyzeAudioEnergy(signed_url)
        .then((res) => {
          const d = res?.duration ?? null;
          setDuration(d);
          if (d) onChange?.({ file_uri, signed_url, duration: d, name: file.name, file });
        })
        .catch(() => setDuration(null));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const openPicker = () => {
    if (typeof guard === 'function') guard(handleFile);
    else handleFile();
  };

  const clear = () => {
    onChange?.({ file_uri: '', signed_url: '', duration: null, name: '', file: null });
    setPlayUrl('');
    setName('');
    setDuration(null);
  };

  if (!value) {
    return (
      <Pressable
        onPress={openPicker}
        disabled={busy}
        className="items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 px-6 py-10 active:border-primary/50">
        {busy ? <ActivityIndicator size="large" /> : <Icon as={Upload} size={32} className="text-muted-foreground" />}
        <Text className="text-sm font-medium text-muted-foreground">{busy ? 'Uploading…' : 'Upload song'}</Text>
        <Text className="text-xs text-muted-foreground/70">MP3 · WAV · M4A — stored privately</Text>
      </Pressable>
    );
  }

  return (
    <View className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <View className="flex-row items-center gap-3">
        <View className="size-12 items-center justify-center rounded-xl bg-primary/15">
          <Icon as={Music} size={24} className="text-primary" />
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-semibold">{name || 'Audio file'}</Text>
          <Text className="text-xs text-muted-foreground">
            {duration ? `${fmtDuration(duration)} · ` : ''}MP3/WAV/M4A · ready for the studio
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Pressable onPress={openPicker} disabled={busy} accessibilityLabel="Replace audio" className="size-11 items-center justify-center rounded-lg bg-muted">
            {busy ? <ActivityIndicator size="small" /> : <Icon as={RefreshCw} size={16} className="text-muted-foreground" />}
          </Pressable>
          <Pressable onPress={clear} accessibilityLabel="Remove audio" className="size-11 items-center justify-center rounded-lg bg-muted">
            <Icon as={X} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>
      {previewUrl ? <AudioPreview key={previewUrl} url={previewUrl} /> : null}
    </View>
  );
}
