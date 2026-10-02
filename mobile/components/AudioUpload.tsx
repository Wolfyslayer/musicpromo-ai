import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { Loader2, Music, RefreshCw, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useToast } from '@/lib/toast';
import { supabase } from '@/lib/supabaseClient';
import { fmtDuration } from '@/services/format';

export default function AudioUpload({
  value,
  signedUrl,
  onChange,
  guard,
}: {
  value?: string;
  signedUrl?: string;
  onChange: (payload: {
    file_uri: string;
    signed_url: string;
    duration: number | null;
    name: string;
    file?: Blob | null;
  }) => void;
  guard?: (action: () => void) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [playUrl, setPlayUrl] = useState(signedUrl || '');
  const { toast } = useToast();

  const pick = async () => {
    const run = async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const fileName = asset.name || 'audio.mp3';
      const ok = /\.(mp3|wav|m4a)$/i.test(fileName) || (asset.mimeType || '').startsWith('audio/');
      if (!ok) {
        toast({ title: 'Unsupported file', description: 'Use MP3, WAV, or M4A.' });
        return;
      }
      setBusy(true);
      try {
        if (!supabase) throw new Error('Configure Supabase env vars to upload.');
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth?.user) throw new Error('Sign in to upload audio.');
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        const safeName = String(fileName).replace(/[^\w.\-]+/g, '_');
        const path = `${auth.user.id}/audio/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from('music-promo-assets').upload(path, blob, {
          contentType: asset.mimeType || 'audio/mpeg',
          upsert: false,
        });
        if (error) throw new Error(error.message);
        const { data } = supabase.storage.from('music-promo-assets').getPublicUrl(path);
        const file_uri = data.publicUrl;
        const signed_url = data.publicUrl;
        setName(fileName);
        setPlayUrl(signed_url);
        let d: number | null = null;
        try {
          const { sound, status } = await Audio.Sound.createAsync({ uri: signed_url }, { shouldPlay: false });
          if (status.isLoaded && status.durationMillis) {
            d = status.durationMillis / 1000;
            setDuration(d);
          }
          await sound.unloadAsync();
        } catch {
          setDuration(null);
        }
        onChange({ file_uri, signed_url, duration: d, name: fileName, file: blob });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        toast({ title: 'Upload failed', description: msg });
      } finally {
        setBusy(false);
      }
    };
    if (typeof guard === 'function') guard(run);
    else run();
  };

  const clear = () => {
    setName('');
    setDuration(null);
    setPlayUrl('');
    onChange({ file_uri: '', signed_url: '', duration: null, name: '', file: null });
  };

  return (
    <View>
      {value || playUrl ? (
        <View className="rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <Music color="#8b5cf6" size={22} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-semibold text-foreground" numberOfLines={1}>
                {name || 'Uploaded track'}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {duration != null ? fmtDuration(duration) : 'Duration unknown'}
              </Text>
            </View>
            <Pressable onPress={pick} className="rounded-full border border-border p-2">
              <RefreshCw color="#64748b" size={18} />
            </Pressable>
            <Pressable onPress={clear} className="rounded-full bg-destructive p-2">
              <X color="#fff" size={16} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={pick}
          className="items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 py-10"
        >
          {busy ? <Loader2 color="#64748b" size={28} /> : <Upload color="#64748b" size={28} />}
          <Text className="mt-2 text-sm text-muted-foreground">Upload MP3, WAV, or M4A</Text>
        </Pressable>
      )}
    </View>
  );
}
