import { db } from '@/api/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowLeft,
  CalendarDays,
  Film,
  Link2,
  ListMusic,
  Music2,
  Pencil,
  Plus,
  Share2,
  Sparkles,
} from 'lucide-react-native';
import { ArtworkImage } from '@/components/ArtworkImage';
import { CampaignCard } from '@/components/CampaignCard';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useToast } from '@/lib/toast';
import { loadRelease } from '@/services/data';
import { fmtDate } from '@/services/format';

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Music2 }) {
  return (
    <View className="rounded-2xl border border-border bg-card/50 p-4">
      <View className="flex-row items-center gap-2">
        <Icon color="#8b5cf6" size={16} />
        <Text className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Text>
      </View>
      <Text className="mt-2 text-2xl font-bold text-foreground">{value}</Text>
    </View>
  );
}

export default function ReleaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [songToAdd, setSongToAdd] = useState('');
  const [linking, setLinking] = useState(false);

  const reload = () =>
    loadRelease(String(id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load release'));

  useEffect(() => {
    reload();
  }, [id]);

  const addSong = async () => {
    if (!songToAdd || !id) return;
    setLinking(true);
    try {
      await db.entities.Song.update(songToAdd, { release_id: id });
      toast({ title: 'Song added to release' });
      setSongToAdd('');
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add song';
      toast({ title: 'Could not add song', description: msg });
    } finally {
      setLinking(false);
    }
  };

  if (error) {
    return (
      <ScrollView className="flex-1 bg-background p-4">
        <Pressable onPress={() => router.push('/releases')} className="mb-4 flex-row items-center gap-1.5">
          <ArrowLeft color="#64748b" size={16} />
          <Text className="text-sm text-muted-foreground">Back to releases</Text>
        </Pressable>
        <Text className="text-destructive">{error}</Text>
      </ScrollView>
    );
  }

  if (!data) return <ActivityIndicator className="flex-1 py-24" />;

  const release = data.release as Record<string, unknown>;
  const artist = data.artist as { name?: string } | undefined;
  const songs = (data.songs as Array<Record<string, unknown>>) || [];
  const campaigns = (data.campaigns as Array<Record<string, unknown>>) || [];
  const contentCount = Number(data.contentCount) || 0;
  const videosCount = Number(data.videosCount) || 0;
  const daysCount = Number(data.daysCount) || 0;
  const unassignedSongs = (data.unassignedSongs as Array<{ id: string; title?: string }>) || [];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4">
      <Pressable onPress={() => router.push('/releases')} className="flex-row items-center gap-1.5">
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">Back to releases</Text>
      </Pressable>

      <View className="overflow-hidden rounded-3xl border border-border bg-card p-5">
        <View className="flex-row gap-4">
          <ArtworkImage src={release.artwork_url as string} className="h-28 w-28" rounded="rounded-2xl" />
          <View className="min-w-0 flex-1">
            <StatusBadge status={String(release.status || 'draft')} />
            <Text className="mt-2 text-2xl font-bold text-foreground" numberOfLines={2}>
              {String(release.title || 'Untitled')}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {artist?.name || 'Unknown artist'} · {fmtDate(String(release.release_date || ''))}
            </Text>
            {release.description ? (
              <Text className="mt-2 text-sm text-muted-foreground" numberOfLines={2}>
                {String(release.description)}
              </Text>
            ) : null}
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Button variant="outline" label="Edit" onPress={() => router.push(`/releases/${id}/edit`)} />
              <Button label="Calendar" onPress={() => router.push(`/releases/${id}/calendar`)} />
              <Button variant="outline" label="Content" onPress={() => router.push(`/releases/${id}/content`)} />
              <Button variant="outline" label="Social" onPress={() => router.push('/social')} />
            </View>
          </View>
        </View>
      </View>

      <View>
        <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Overview</Text>
        <View className="flex-row flex-wrap gap-3">
          <Stat label="Songs" value={songs.length} icon={Music2} />
          <Stat label="Campaigns" value={campaigns.length} icon={ListMusic} />
          <Stat label="Campaign days" value={daysCount} icon={CalendarDays} />
          <Stat label="Content" value={contentCount} icon={Sparkles} />
          <Stat label="Videos" value={videosCount} icon={Film} />
        </View>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Songs</Text>
          <Button label="New Campaign" onPress={() => router.push('/create')} />
        </View>

        {unassignedSongs.length > 0 ? (
          <View className="gap-2 rounded-2xl border border-border bg-muted/20 p-3">
            <Select value={songToAdd} onValueChange={setSongToAdd}>
              <SelectTrigger>
                <SelectValue placeholder="Add existing song…" />
              </SelectTrigger>
              <SelectContent>
                {unassignedSongs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title || 'Song'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" label={linking ? 'Adding…' : 'Add Song'} disabled={!songToAdd || linking} onPress={addSong} />
          </View>
        ) : null}

        {songs.length ? (
          songs.map((s) => {
            const related = campaigns.find((c) => c.song_id === s.id);
            return (
              <Pressable
                key={String(s.id)}
                onPress={() => (related ? router.push(`/campaigns/${related.id}`) : router.push('/create'))}
                className="flex-row items-center gap-3 rounded-xl border border-border bg-card/40 p-3"
              >
                <ArtworkImage src={s.artwork_url as string} className="h-12 w-12" rounded="rounded-lg" />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {String(s.title)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {related ? 'Open campaign' : 'No campaign yet — create one'}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <EmptyState
            icon={Music2}
            title="No songs on this release"
            description="Create a campaign with this release selected, or add an existing unassigned song."
          />
        )}
      </View>

      <View className="gap-3">
        <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Campaigns</Text>
        {campaigns.length ? (
          campaigns.map((c) => (
            <CampaignCard
              key={String(c.id)}
              campaign={c as never}
              song={c.song as never}
              artist={artist as never}
              daysCount={Number(c.daysCount) || 0}
              videosCount={0}
            />
          ))
        ) : (
          <EmptyState
            icon={ListMusic}
            title="No campaigns yet"
            description="Create a campaign and optionally attach this release."
            action={<Button label="New Campaign" onPress={() => router.push('/create')} />}
          />
        )}
      </View>
    </ScrollView>
  );
}
