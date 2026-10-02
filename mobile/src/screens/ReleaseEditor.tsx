import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { db } from '@/api/base44Client';
import ArtworkUpload from '@/components/ArtworkUpload';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Icon } from '@/components/ui/icon';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { RELEASE_STATUSES } from '@/services/constants';
import { loadArtists } from '@/services/data';
import { todayISO } from '@/services/format';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Label className="mb-0 text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </View>
  );
}

export default function ReleaseEditor() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isNew = !id || id === 'new';
  const releaseId = isNew ? null : id;
  const router = useRouter();
  const { requireAuth } = useAuth();
  const [artists, setArtists] = useState<any[]>([]);
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
    loadArtists()
      .then(setArtists)
      .catch(() => setArtists([]));
  }, []);

  useEffect(() => {
    if (isNew || !releaseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    db.entities.Release.get(releaseId)
      .then((r: any) => {
        setForm({
          title: r.title || '',
          artist_id: r.artist_id || '',
          release_date: r.release_date || todayISO(),
          status: r.status || 'draft',
          artwork_url: r.artwork_url || '',
          description: r.description || '',
          presave_url: r.presave_url || '',
        });
      })
      .catch((e: any) => {
        toast({ variant: 'destructive', title: 'Release not found', description: e.message });
        router.replace('/releases');
      })
      .finally(() => setLoading(false));
  }, [releaseId, isNew, router]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title?.trim()) {
      toast({ variant: 'destructive', title: 'Title required' });
      return;
    }
    if (!form.artist_id) {
      toast({ variant: 'destructive', title: 'Artist required' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        artist_id: form.artist_id,
        release_date: form.release_date || null,
        status: form.status || 'draft',
        artwork_url: form.artwork_url || '',
        description: form.description || '',
        presave_url: form.presave_url || '',
        is_demo: false,
      };
      if (isNew) {
        const created = await db.entities.Release.create(payload);
        toast({ title: 'Release created' });
        router.replace(`/releases/${created.id}`);
      } else {
        await db.entities.Release.update(releaseId, payload);
        toast({ title: 'Release saved' });
        router.replace(`/releases/${releaseId}`);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton className="h-64 rounded-2xl" />
      </Screen>
    );
  }

  return (
    <Screen contentClassName="gap-5">
      <Pressable onPress={() => router.replace(isNew ? '/releases' : `/releases/${releaseId}`)} className="flex-row items-center gap-1.5 self-start py-1">
        <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
        <Text className="text-sm text-muted-foreground">Back</Text>
      </Pressable>
      <Text className="font-heading-bold text-2xl tracking-tight">{isNew ? 'New Release' : 'Edit Release'}</Text>

      <View className="gap-5 rounded-2xl border border-border bg-card p-5">
        <View>
          <Label className="text-xs font-medium text-muted-foreground">Artwork</Label>
          <ArtworkUpload guard={requireAuth} value={form.artwork_url} onChange={(payload: any) => set('artwork_url', typeof payload === 'string' ? payload : payload?.url || '')} />
        </View>

        <Field label="Release Title *">
          <Input value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Vad lämnar vi efter oss?" className="rounded-xl" />
        </Field>

        <Field label="Artist *">
          <Select
            value={form.artist_id}
            onValueChange={(v) => set('artist_id', v)}
            placeholder="Select artist"
            className="rounded-xl"
            options={artists.map((a) => ({ value: a.id, label: a.name }))}
          />
        </Field>
        <Field label="Release Date">
          <DateField value={form.release_date} onChange={(v) => set('release_date', v)} className="rounded-xl" />
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => set('status', v)} className="rounded-xl" options={RELEASE_STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
        </Field>
        <Field label="Pre-save URL (optional)">
          <Input value={form.presave_url} onChangeText={(v) => set('presave_url', v)} placeholder="https://" autoCapitalize="none" keyboardType="url" className="rounded-xl" />
        </Field>

        <Field label="Description (optional)">
          <Textarea value={form.description} onChangeText={(v) => set('description', v)} numberOfLines={3} placeholder="Short release notes…" className="rounded-xl" />
        </Field>

        <Button onPress={save} loading={busy} className="rounded-full">
          {busy ? 'Saving…' : isNew ? 'Create Release' : 'Save Release'}
        </Button>
      </View>
    </Screen>
  );
}
