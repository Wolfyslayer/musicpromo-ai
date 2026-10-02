import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Archive, Copy, Plus, Search, Trash2 } from 'lucide-react-native';
import { db } from '@/api/db';
import { CampaignCard } from '@/components/CampaignCard';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/lib/toast';
import { loadCampaigns } from '@/services/data';
import { CAMPAIGN_STATUSES } from '@/services/constants';

export default function CampaignsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>> | null>(null);
  const [q, setQ] = useState('');
  const [artist, setArtist] = useState('all');
  const [status, setStatus] = useState('all');
  const [menuId, setMenuId] = useState<string | null>(null);

  const reload = () => loadCampaigns().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    reload();
  }, []);

  const artists = useMemo(() => {
    const map: Record<string, { id: string; name?: string }> = {};
    (rows || []).forEach((r) => {
      const a = r.artist as { id: string; name?: string } | undefined;
      if (a) map[a.id] = a;
    });
    return Object.values(map);
  }, [rows]);

  const filtered = (rows || []).filter((c) => {
    const song = c.song as { title?: string } | undefined;
    const art = c.artist as { name?: string } | undefined;
    const matchQ =
      !q ||
      (song?.title || '').toLowerCase().includes(q.toLowerCase()) ||
      (art?.name || '').toLowerCase().includes(q.toLowerCase());
    const matchArtist = artist === 'all' || c.artist_id === artist;
    const matchStatus = status === 'all' || c.status === status;
    return matchQ && matchArtist && matchStatus;
  });

  const duplicate = async (c: Record<string, unknown>) => {
    await db.entities.Campaign.create({
      song_id: c.song_id,
      artist_id: c.artist_id,
      name: `${c.name || 'Campaign'} (copy)`,
      status: 'draft',
      duration_days: c.duration_days,
      goals: c.goals || [],
      start_date: c.start_date,
      end_date: c.end_date,
      summary: c.summary,
      is_demo: false,
    });
    toast({ title: 'Campaign duplicated' });
    reload();
  };

  const archive = async (c: Record<string, unknown>) => {
    await db.entities.Campaign.update(String(c.id), { status: 'archived' });
    toast({ title: 'Campaign archived' });
    reload();
  };

  const remove = async (c: Record<string, unknown>) => {
    await db.entities.CampaignDay.deleteMany({ campaign_id: c.id });
    await db.entities.Campaign.delete(String(c.id));
    setMenuId(null);
    toast({ title: 'Campaign deleted' });
    reload();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Campaigns</Text>
        <Button label="New" onPress={() => router.push('/create')} className="px-5" />
      </View>

      <Input value={q} onChangeText={setQ} placeholder="Search song or artist…" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
        <Button
          variant={artist === 'all' ? 'default' : 'outline'}
          label="All artists"
          onPress={() => setArtist('all')}
          className="mr-2"
        />
        {artists.map((a) => (
          <Button
            key={a.id}
            variant={artist === a.id ? 'default' : 'outline'}
            label={a.name || 'Artist'}
            onPress={() => setArtist(a.id)}
            className="mr-2"
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Button
          variant={status === 'all' ? 'default' : 'outline'}
          label="All statuses"
          onPress={() => setStatus('all')}
          className="mr-2"
        />
        {CAMPAIGN_STATUSES.map((s) => (
          <Button
            key={s.id}
            variant={status === s.id ? 'default' : 'outline'}
            label={s.label}
            onPress={() => setStatus(s.id)}
            className="mr-2"
          />
        ))}
      </ScrollView>

      {filtered.length ? (
        <View className="gap-3">
          {filtered.map((c) => (
            <View key={String(c.id)}>
              <CampaignCard
                campaign={c as never}
                song={c.song as never}
                artist={c.artist as never}
                daysCount={Number(c.daysCount) || 0}
                videosCount={Number(c.videosCount) || 0}
                onAction={() => setMenuId(String(c.id))}
              />
              {menuId === c.id ? (
                <View className="mt-2 flex-row flex-wrap gap-2">
                  <Button variant="outline" label="Duplicate" onPress={() => duplicate(c)} />
                  <Button variant="outline" label="Archive" onPress={() => archive(c)} />
                  <Button variant="destructive" label="Delete" onPress={() => remove(c)} />
                  <Button variant="ghost" label="Close" onPress={() => setMenuId(null)} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={Search}
          title="No campaigns"
          description="Create your first campaign to start promoting."
          action={<Button label="Create campaign" onPress={() => router.push('/create')} />}
        />
      )}
    </ScrollView>
  );
}
