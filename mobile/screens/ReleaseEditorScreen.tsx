import { db } from '@/api/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Loader2 } from 'lucide-react-native';
import ArtworkUpload from '@/components/ArtworkUpload';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/toast';
import { RELEASE_STATUSES } from '@/services/constants';
import { loadArtists } from '@/services/data';
import { todayISO } from '@/services/format';

export default function ReleaseEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id || id === 'new';
  const releaseId = isNew ? null : id;
  const router = useRouter();
  const { toast } = useToast();
  const { requireAuth } = useAuth();
  const [artists, setArtists] = useState<Array<{ id: string; name?: string }>>([]);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    artist_id: '',
    release_date: todayISO(),
    status: 'draft',
    artwork_url: '',
    description: '',
    presave_url: '',
  });

  useEffect(() => {
    loadArtists().then(setArtists).catch(() => setArtists([]));
  }, []);

  useEffect(() => {
    if (isNew || !releaseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    db.entities.Release.get(releaseId)
      .then((r) => {
        const row = r as Record<string, string>;
        setForm({
          title: row.title || '',
          artist_id: row.artist_id || '',
          release_date: row.release_date || todayISO() || '',
          status: row.status || 'draft',
          artwork_url: row.artwork_url || '',
          description: row.description || '',
          presave_url: row.presave_url || '',
        });
      })
      .catch((e) => {
        toast({ title: 'Release not found', description: e instanceof Error ? e.message : undefined });
        router.push('/releases');
      })
      .finally(() => setLoading(false));
  }, [releaseId, isNew, router, toast]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title?.trim()) {
      toast({ title: 'Title required' });
      return;
    }
    if (!form.artist_id) {
      toast({ title: 'Artist required' });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, title: form.title.trim(), is_demo: false };
      if (isNew) {
        const created = await db.entities.Release.create(payload);
        toast({ title: 'Release created' });
        router.push(`/releases/${created.id}`);
      } else if (releaseId) {
        await db.entities.Release.update(releaseId, payload);
        toast({ title: 'Release saved' });
        router.push(`/releases/${releaseId}`);
      }
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <ActivityIndicator className="flex-1 py-24" />;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4">
      <Pressable onPress={() => router.push(isNew ? '/releases' : `/releases/${releaseId}`)} className="flex-row items-center gap-1.5">
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">Back</Text>
      </Pressable>
      <Text className="text-2xl font-bold text-foreground">{isNew ? 'New Release' : 'Edit Release'}</Text>

      <View className="gap-5 rounded-2xl border border-border bg-card p-5">
        <View>
          <Label>Artwork</Label>
          <ArtworkUpload
            guard={requireAuth}
            value={form.artwork_url}
            onChange={(payload) => set('artwork_url', typeof payload === 'string' ? payload : payload?.url || '')}
          />
        </View>

        <View>
          <Label>Release Title *</Label>
          <Input value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. My Album" />
        </View>

        <View>
          <Label>Artist *</Label>
          <Select value={form.artist_id} onValueChange={(v) => set('artist_id', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select artist" />
            </SelectTrigger>
            <SelectContent>
              {artists.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name || 'Artist'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>

        <View>
          <Label>Release Date</Label>
          <Input value={form.release_date} onChangeText={(v) => set('release_date', v)} placeholder="YYYY-MM-DD" />
        </View>

        <View>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELEASE_STATUSES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>

        <View>
          <Label>Pre-save URL (optional)</Label>
          <Input value={form.presave_url} onChangeText={(v) => set('presave_url', v)} placeholder="https://" />
        </View>

        <View>
          <Label>Description (optional)</Label>
          <Textarea value={form.description} onChangeText={(v) => set('description', v)} placeholder="Short release notes…" />
        </View>

        <Button disabled={busy} onPress={save}>
          {busy ? <Loader2 color="#fff" size={16} /> : null}
          <Text className="ml-1 font-semibold text-white">{busy ? 'Saving…' : isNew ? 'Create Release' : 'Save Release'}</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
