import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Loader2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArtworkImage } from '@/components/ArtworkImage';
import { useToast } from '@/lib/toast';
import { supabase } from '@/lib/supabaseClient';

export default function ArtworkUpload({
  value,
  onChange,
  guard,
}: {
  value?: string;
  onChange: (payload: string | { url: string; file?: unknown }) => void;
  guard?: (action: () => void) => void;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const emit = (url: string, file?: unknown) => {
    onChange({ url: url || '', file: file || null });
  };

  const pick = async () => {
    const run = async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast({ title: 'Permission needed', description: 'Allow photo library access to upload artwork.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setBusy(true);
      try {
        if (!supabase) throw new Error('Configure Supabase env vars to upload.');
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth?.user) throw new Error('Sign in to upload artwork.');
        const uri = asset.uri;
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const safeName = String(asset.fileName || 'artwork.jpg').replace(/[^\w.\-]+/g, '_');
        const path = `${auth.user.id}/artwork/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from('music-promo-assets').upload(path, blob, {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: false,
        });
        if (error) throw new Error(error.message);
        const { data } = supabase.storage.from('music-promo-assets').getPublicUrl(path);
        emit(data.publicUrl, blob);
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

  return (
    <View>
      {value ? (
        <View className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl border border-border">
          <ArtworkImage src={value} className="h-full w-full" rounded="rounded-3xl" />
          <View className="absolute right-2 top-2 flex-row gap-2">
            <Pressable onPress={pick} className="rounded-full bg-black/60 px-3 py-2">
              <Text className="text-xs text-white">Replace</Text>
            </Pressable>
            <Pressable
              onPress={() => emit('')}
              className="h-8 w-8 items-center justify-center rounded-full bg-destructive"
            >
              <X color="#fff" size={16} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={pick}
          className="mx-auto aspect-square w-full max-w-xs items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/30"
        >
          {busy ? <Loader2 color="#64748b" size={28} /> : <ImagePlus color="#64748b" size={28} />}
          <Text className="mt-2 text-sm text-muted-foreground">Upload artwork</Text>
        </Pressable>
      )}
    </View>
  );
}
