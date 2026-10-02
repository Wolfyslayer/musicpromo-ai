import { ImagePlus, RefreshCw, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { db } from '@/api/base44Client';
import ArtworkImage from '@/components/ArtworkImage';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { pickImage } from '@/lib/pickers';

/**
 * Artwork uploader. Album art goes to the public music-promo-assets bucket.
 * onChange({ url, file }) where `file` is the picked `{ uri, name, type }`.
 */
export default function ArtworkUpload({ value, onChange, guard }: { value?: string; onChange?: (payload: any) => void; guard?: (cb: () => void) => void }) {
  const [busy, setBusy] = useState(false);

  const emit = (url: string, file: any) => {
    if (typeof onChange !== 'function') return;
    onChange({ url: url || '', file: file || null });
  };

  const handleFile = async () => {
    const file = await pickImage();
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      toast({ variant: 'destructive', title: 'Unsupported file', description: 'Use JPG, PNG or WEBP.' });
      return;
    }
    setBusy(true);
    try {
      const uploaded = await db.integrations.Core.UploadPublicFile({ file });
      const url = uploaded?.file_url || uploaded?.publicUrl || uploaded?.url || '';
      if (!url) throw new Error('Upload succeeded but no public URL was returned.');
      emit(url, file);
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

  return (
    <View>
      {value ? (
        <View className="aspect-square w-full max-w-xs self-center overflow-hidden rounded-3xl border border-border/70">
          <ArtworkImage src={value} className="size-full" rounded="rounded-3xl" />
          <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between gap-2 bg-black/60 p-3">
            <Pressable onPress={openPicker} disabled={busy} className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-white/20 px-4">
              <Icon as={RefreshCw} size={14} color="#ffffff" />
              <Text className="text-xs font-medium text-white">Replace</Text>
            </Pressable>
            <Pressable onPress={() => emit('', null)} className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-white/20 px-4">
              <Icon as={X} size={14} color="#ffffff" />
              <Text className="text-xs font-medium text-white">Remove</Text>
            </Pressable>
          </View>
          {busy ? (
            <View className="absolute inset-0 items-center justify-center bg-black/50">
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={openPicker}
          disabled={busy}
          className="aspect-square w-full max-w-xs items-center justify-center gap-3 self-center rounded-3xl border-2 border-dashed border-border/70 bg-muted/30 active:border-primary/50">
          {busy ? <ActivityIndicator size="large" /> : <Icon as={ImagePlus} size={32} className="text-muted-foreground" />}
          <Text className="text-sm font-medium text-muted-foreground">Upload artwork</Text>
          <Text className="text-xs text-muted-foreground/70">JPG · PNG · WEBP</Text>
        </Pressable>
      )}
    </View>
  );
}
