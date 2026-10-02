import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ImagePlus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { db } from '@/api/base44Client';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { pickImage } from '@/lib/pickers';
import { GENRES } from '@/services/constants';

const FIELDS = [
  { key: 'website', label: 'Website' },
  { key: 'spotify_url', label: 'Spotify URL' },
  { key: 'youtube_url', label: 'YouTube URL' },
  { key: 'tiktok_url', label: 'TikTok URL' },
  { key: 'instagram_url', label: 'Instagram URL' },
  { key: 'facebook_url', label: 'Facebook URL' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Label className="mb-0 text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </View>
  );
}

export default function ArtistEditor() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isNew = !id || id === 'new';
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any>>({
    name: '',
    profile_image: '',
    biography: '',
    genre: '',
    location: '',
    website: '',
    spotify_url: '',
    youtube_url: '',
    tiktok_url: '',
    instagram_url: '',
    facebook_url: '',
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isNew) {
      db.entities.Artist.get(id)
        .then((a: any) => setForm((f) => ({ ...f, ...a })))
        .catch(() => router.replace('/artists'));
    }
  }, [id, isNew, router]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const chooseImage = async () => {
    if (uploading) return;
    try {
      const file = await pickImage();
      if (!file) return;
      setUploading(true);
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
      set('profile_image', file_url);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: e.message });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast({ variant: 'destructive', title: 'Name required' });
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        const created = await db.entities.Artist.create({ ...form, is_demo: false });
        toast({ title: 'Artist created' });
        router.replace(`/artists/${created.id}`);
      } else {
        await db.entities.Artist.update(id, form);
        toast({ title: 'Artist saved' });
        router.replace('/artists');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentClassName="gap-5">
      <Pressable onPress={() => router.replace('/artists')} className="flex-row items-center gap-1.5 self-start py-1">
        <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
        <Text className="text-sm text-muted-foreground">Back to artists</Text>
      </Pressable>
      <Text className="font-heading-bold text-2xl tracking-tight">{isNew ? 'New Artist' : 'Edit Artist'}</Text>

      <View className="gap-5 rounded-2xl border border-border bg-card p-5">
        <View className="flex-row items-center gap-4">
          {form.profile_image ? (
            <View>
              <Image source={{ uri: form.profile_image }} style={{ width: 80, height: 80, borderRadius: 40 }} contentFit="cover" />
              <Pressable onPress={() => set('profile_image', '')} hitSlop={8} className="absolute -right-1 -top-1 size-6 items-center justify-center rounded-full bg-destructive">
                <Icon as={X} size={14} className="text-destructive-foreground" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={chooseImage} className="size-20 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/30">
              {uploading ? <ActivityIndicator /> : <Icon as={ImagePlus} size={24} className="text-muted-foreground" />}
            </Pressable>
          )}
          <View className="flex-1">
            <Text className="text-sm font-semibold">Profile image</Text>
            <Text className="text-xs text-muted-foreground">JPG / PNG / WEBP — stored publicly.</Text>
            {form.profile_image ? (
              <Pressable onPress={chooseImage} hitSlop={8} className="mt-1 self-start">
                <Text className="text-xs text-primary">{uploading ? 'Uploading…' : 'Replace'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View className="gap-4">
          <Field label="Artist Name *">
            <Input value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Aurora Vale" />
          </Field>
          <Field label="Genre">
            <Select value={form.genre} onValueChange={(v) => set('genre', v)} options={GENRES} placeholder="Select genre" className="rounded-xl" />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChangeText={(v) => set('location', v)} placeholder="e.g. Stockholm, SE" />
          </Field>
          <Field label="Website">
            <Input value={form.website} onChangeText={(v) => set('website', v)} placeholder="https://" autoCapitalize="none" keyboardType="url" />
          </Field>
        </View>

        <Field label="Biography">
          <Textarea value={form.biography} onChangeText={(v) => set('biography', v)} numberOfLines={4} placeholder="Short bio…" />
        </Field>

        <View className="gap-4">
          {FIELDS.filter((f) => f.key !== 'website').map((f) => (
            <Field key={f.key} label={f.label}>
              <Input value={form[f.key]} onChangeText={(v) => set(f.key, v)} placeholder="https://" autoCapitalize="none" keyboardType="url" />
            </Field>
          ))}
        </View>

        <View className="flex-row justify-end gap-2">
          <Button variant="ghost" onPress={() => router.replace('/artists')}>
            Cancel
          </Button>
          <Button onPress={save} loading={busy} className="rounded-full">
            {isNew ? 'Create Artist' : 'Save'}
          </Button>
        </View>
      </View>
    </Screen>
  );
}
