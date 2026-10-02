import { db } from '@/api/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react-native';
import { ArtworkImage } from '@/components/ArtworkImage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/lib/toast';
import { GENRES } from '@/services/constants';

const FIELDS = [
  { key: 'website', label: 'Website' },
  { key: 'spotify_url', label: 'Spotify URL' },
  { key: 'youtube_url', label: 'YouTube URL' },
  { key: 'tiktok_url', label: 'TikTok URL' },
  { key: 'instagram_url', label: 'Instagram URL' },
  { key: 'facebook_url', label: 'Facebook URL' },
];

type Form = Record<string, string>;

export default function ArtistEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Form>({
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
    if (!isNew && id) {
      db.entities.Artist.get(id)
        .then((a) => setForm((f) => ({ ...f, ...(a as Form) })))
        .catch(() => router.push('/artists'));
    }
  }, [id, isNew, router]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const blob = await (await fetch(uri)).blob();
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file: blob });
      set('profile_image', file_url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      toast({ title: 'Upload failed', description: msg });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast({ title: 'Name required' });
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        const created = await db.entities.Artist.create({ ...form, is_demo: false });
        toast({ title: 'Artist created' });
        router.push(`/artists/${created.id}`);
      } else if (id) {
        await db.entities.Artist.update(id, form);
        toast({ title: 'Artist saved' });
        router.push('/artists');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      toast({ title: 'Save failed', description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4">
      <Pressable onPress={() => router.push('/artists')} className="flex-row items-center gap-1.5">
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">Back to artists</Text>
      </Pressable>
      <Text className="text-2xl font-bold text-foreground">{isNew ? 'New Artist' : 'Edit Artist'}</Text>

      <View className="gap-5 rounded-2xl border border-border bg-card p-5">
        <View className="flex-row items-center gap-4">
          {form.profile_image ? (
            <View>
              <ArtworkImage src={form.profile_image} className="h-20 w-20 rounded-full" />
              <Pressable onPress={() => set('profile_image', '')} className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-destructive">
                <X color="#fff" size={14} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={pickImage} className="h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-border">
              {uploading ? <Loader2 color="#64748b" size={24} /> : <ImagePlus color="#64748b" size={24} />}
            </Pressable>
          )}
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">Profile image</Text>
            <Text className="text-xs text-muted-foreground">JPG / PNG / WEBP — stored publicly.</Text>
            {form.profile_image ? (
              <Pressable onPress={pickImage} className="mt-1">
                <Text className="text-xs text-primary">Replace</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View className="gap-4">
          <View>
            <Label>Artist Name *</Label>
            <Input value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Aurora Vale" />
          </View>
          <View>
            <Label>Genre</Label>
            <Select value={form.genre} onValueChange={(v) => set('genre', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </View>
          <View>
            <Label>Location</Label>
            <Input value={form.location} onChangeText={(v) => set('location', v)} placeholder="e.g. Stockholm, SE" />
          </View>
          <View>
            <Label>Website</Label>
            <Input value={form.website} onChangeText={(v) => set('website', v)} placeholder="https://" />
          </View>
        </View>

        <View>
          <Label>Biography</Label>
          <Textarea value={form.biography} onChangeText={(v) => set('biography', v)} placeholder="Short bio…" />
        </View>

        {FIELDS.filter((f) => !['website'].includes(f.key)).map((f) => (
          <View key={f.key}>
            <Label>{f.label}</Label>
            <Input value={form[f.key] || ''} onChangeText={(v) => set(f.key, v)} placeholder="https://" />
          </View>
        ))}

        <View className="flex-row justify-end gap-2">
          <Button variant="ghost" label="Cancel" onPress={() => router.push('/artists')} />
          <Button label={busy ? 'Saving…' : isNew ? 'Create Artist' : 'Save'} disabled={busy} onPress={save} />
        </View>
      </View>
    </ScrollView>
  );
}
