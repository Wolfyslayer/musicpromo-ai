import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, Film, Link2, ListMusic, Music2, Pencil, Plus, Share2, Sparkles } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { db } from '@/api/base44Client';
import ArtworkImage from '@/components/ArtworkImage';
import CampaignCard from '@/components/CampaignCard';
import EmptyState from '@/components/EmptyState';
import { Screen, SectionTitle } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { useWorkspaceRefresh } from '@/lib/AuthContext';
import { loadRelease } from '@/services/data';
import { fmtDate } from '@/services/format';

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon: any }) {
  return (
    <View className="w-[48.5%] rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-2">
        <Icon as={icon} size={16} className="text-primary" />
        <Text className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Text>
      </View>
      <Text className="mt-2 font-heading-bold text-2xl">{value}</Text>
    </View>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1.5 self-start py-1">
      <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </Pressable>
  );
}

export default function ReleaseDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [songToAdd, setSongToAdd] = useState('');
  const [linking, setLinking] = useState(false);

  const reload = useCallback(
    () =>
      loadRelease(id)
        .then((d: any) => {
          setError('');
          setData(d);
        })
        .catch((e: any) => setError(e.message || 'Failed to load release')),
    [id]
  );
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
  useWorkspaceRefresh(reload);

  const addSong = async () => {
    if (!songToAdd) return;
    setLinking(true);
    try {
      await db.entities.Song.update(songToAdd, { release_id: id });
      toast({ title: 'Song added to release' });
      setSongToAdd('');
      reload();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not add song', description: e.message });
    } finally {
      setLinking(false);
    }
  };

  if (error) {
    return (
      <Screen contentClassName="gap-4">
        <BackLink label="Back to releases" onPress={() => router.replace('/releases')} />
        <Text className="text-destructive">{error}</Text>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <Skeleton className="h-64 rounded-2xl" />
      </Screen>
    );
  }

  const { release, artist, songs, campaigns, contentCount, videosCount, daysCount, unassignedSongs } = data;

  return (
    <Screen onRefresh={reload} contentClassName="gap-6">
      <BackLink label="Back to releases" onPress={() => router.replace('/releases')} />

      <View className="gap-4 rounded-3xl border border-border bg-card p-5">
        <ArtworkImage src={release.artwork_url} alt={release.title} className="size-36" rounded="rounded-2xl" />
        <View>
          <StatusBadge status={release.status || 'draft'} />
          <Text className="mt-2 font-heading-bold text-2xl" numberOfLines={2}>
            {release.title || 'Untitled'}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {artist?.name || 'Unknown artist'} · {fmtDate(release.release_date)}
          </Text>
          {release.description ? (
            <Text className="mt-2 text-sm text-muted-foreground" numberOfLines={2}>
              {release.description}
            </Text>
          ) : null}
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push(`/releases/${id}/edit`)}>
              <Icon as={Pencil} size={14} className="text-foreground" />
              <Text className="text-xs font-medium">Edit</Text>
            </Button>
            <Button size="sm" className="rounded-full" onPress={() => router.push(`/releases/${id}/calendar`)}>
              <Icon as={CalendarDays} size={14} className="text-primary-foreground" />
              <Text className="text-xs font-medium text-primary-foreground">View Campaign Calendar</Text>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push(`/releases/${id}/content`)}>
              <Icon as={Sparkles} size={14} className="text-foreground" />
              <Text className="text-xs font-medium">Content</Text>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onPress={() => router.push('/social')}>
              <Icon as={Share2} size={14} className="text-foreground" />
              <Text className="text-xs font-medium">Social</Text>
            </Button>
          </View>
        </View>
      </View>

      <View>
        <SectionTitle>Overview</SectionTitle>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <Stat label="Songs" value={songs.length} icon={Music2} />
          <Stat label="Campaigns" value={campaigns.length} icon={ListMusic} />
          <Stat label="Campaign days" value={daysCount || 0} icon={CalendarDays} />
          <Stat label="Content" value={contentCount} icon={Sparkles} />
          <Stat label="Videos" value={videosCount} icon={Film} />
        </View>
        {campaigns.length > 0 && !(daysCount > 0) ? (
          <Text className="mt-3 text-sm text-muted-foreground">
            No campaign days planned yet.{' '}
            <Text className="text-sm text-primary underline" onPress={() => router.push(`/releases/${id}/calendar`)}>
              Open calendar
            </Text>
          </Text>
        ) : null}
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-2">
          <SectionTitle className="mb-0">Songs</SectionTitle>
          <Button size="sm" className="rounded-full" onPress={() => router.push('/create')}>
            <Icon as={Plus} size={14} className="text-primary-foreground" />
            <Text className="text-xs font-medium text-primary-foreground">New Campaign</Text>
          </Button>
        </View>

        {unassignedSongs?.length > 0 ? (
          <View className="gap-2 rounded-2xl border border-border bg-muted/20 p-3">
            <Select
              value={songToAdd}
              onValueChange={setSongToAdd}
              placeholder="Add existing song…"
              className="rounded-xl"
              options={unassignedSongs.map((s: any) => ({ value: s.id, label: s.title }))}
            />
            <Button onPress={addSong} disabled={!songToAdd || linking} variant="outline" className="rounded-full">
              <Icon as={Link2} size={14} className="text-foreground" />
              <Text className="text-sm font-medium">{linking ? 'Adding…' : 'Add Song'}</Text>
            </Button>
          </View>
        ) : null}

        {songs.length ? (
          <View className="gap-2">
            {songs.map((s: any) => {
              const related = campaigns.find((c: any) => c.song_id === s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => (related ? router.push(`/campaigns/${related.id}`) : router.push('/create'))}
                  className="flex-row items-center gap-3 rounded-xl border border-border bg-card/40 p-3 active:border-primary/40">
                  <ArtworkImage src={s.artwork_url} alt={s.title} className="size-12" rounded="rounded-lg" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" numberOfLines={1}>
                      {s.title}
                    </Text>
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {related ? 'Open campaign' : 'No campaign yet — create one'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState icon={Music2} title="No songs on this release" description="Create a campaign with this release selected, or add an existing unassigned song." />
        )}
      </View>

      <View className="gap-3">
        <SectionTitle className="mb-0">Campaigns</SectionTitle>
        {campaigns.length ? (
          <View className="gap-3">
            {campaigns.map((c: any) => (
              <CampaignCard key={c.id} campaign={c} song={c.song} artist={artist} daysCount={c.daysCount || 0} videosCount={0} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon={ListMusic}
            title="No campaigns yet"
            description="Create a campaign and optionally attach this release."
            action={
              <Button onPress={() => router.push('/create')} className="rounded-full">
                <Icon as={Plus} size={14} className="text-primary-foreground" />
                <Text className="text-sm font-medium text-primary-foreground">New Campaign</Text>
              </Button>
            }
          />
        )}
      </View>
    </Screen>
  );
}
