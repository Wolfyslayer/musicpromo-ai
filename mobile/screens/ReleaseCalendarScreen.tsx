import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ArtworkImage } from '@/components/ArtworkImage';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { platformColor } from '@/services/constants';
import { loadReleaseCalendar } from '@/services/data';
import { buildComposePath } from '@/services/socialService';
import { fmtDate, fmtMonthYear, parseDateOnly, toDateOnlyISO, todayISO } from '@/services/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function buildMonthCells(monthDate: Date) {
  const first = startOfMonth(monthDate);
  const mondayOffset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset + i);
    cells.push({
      date: d,
      iso: toDateOnlyISO(d),
      inMonth: d.getMonth() === monthDate.getMonth(),
    });
  }
  return cells;
}

function entryTitle(entry: Record<string, unknown>) {
  return (
    entry.content_type ||
    entry.objective ||
    entry.hook ||
    `Day ${entry.day_number || ''}`.trim() ||
    'Campaign day'
  );
}

function groupByDate(entries: Array<Record<string, unknown>>) {
  const map: Record<string, Array<Record<string, unknown>>> = {};
  for (const e of entries) {
    const d = String(e.date || '');
    if (!d) continue;
    if (!map[d]) map[d] = [];
    map[d].push(e);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export default function ReleaseCalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [monthReady, setMonthReady] = useState(false);

  useEffect(() => {
    setError('');
    setData(null);
    setMonthReady(false);
    loadReleaseCalendar(String(id))
      .then((result) => {
        setData(result as Record<string, unknown>);
        const releaseDay = parseDateOnly(String((result as { release?: { release_date?: string } }).release?.release_date || ''));
        setMonth(startOfMonth(releaseDay || new Date()));
        setMonthReady(true);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load calendar');
        setMonthReady(true);
      });
  }, [id]);

  const today = todayISO();
  const releaseDate = (data?.release as { release_date?: string })?.release_date || null;

  const byDate = useMemo(() => {
    const map: Record<string, Array<Record<string, unknown>>> = {};
    for (const entry of (data?.entries as Array<Record<string, unknown>>) || []) {
      const d = String(entry.date || '');
      if (!d) continue;
      if (!map[d]) map[d] = [];
      map[d].push(entry);
    }
    return map;
  }, [data]);

  const monthEntries = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    return ((data?.entries as Array<Record<string, unknown>>) || []).filter((e) => {
      const d = parseDateOnly(String(e.date || ''));
      return d && d.getFullYear() === y && d.getMonth() === m;
    });
  }, [data, month]);

  const openEntry = (entry: Record<string, unknown>) => {
    if (!entry?.campaign_id) return;
    router.push(`/campaigns/${entry.campaign_id}?tab=plan`);
  };

  const openContent = (entry: Record<string, unknown>) => {
    if (!entry?.campaign_id) return;
    router.push(`/campaigns/${entry.campaign_id}/content?day=${entry.id}`);
  };

  const openSocial = (entry: Record<string, unknown>) => {
    if (!entry?.campaign_id) return;
    router.push(
      buildComposePath({
        campaignId: String(entry.campaign_id),
        campaignDayId: String(entry.id),
        releaseId: String(id),
      }) as never,
    );
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

  if (!data || !monthReady) return <ActivityIndicator className="flex-1 py-24" />;

  const release = data.release as Record<string, unknown>;
  const artist = data.artist as { name?: string };
  const campaigns = (data.campaigns as Array<Record<string, unknown>>) || [];
  const entries = (data.entries as Array<Record<string, unknown>>) || [];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4">
      <Pressable onPress={() => router.push(`/releases/${id}`)} className="flex-row items-center gap-1.5">
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">Back to Release</Text>
      </Pressable>

      <View className="rounded-3xl border border-border bg-card p-5">
        <View className="flex-row gap-4">
          <ArtworkImage src={release.artwork_url as string} className="h-28 w-28" rounded="rounded-2xl" />
          <View className="min-w-0 flex-1">
            <StatusBadge status={String(release.status || 'draft')} />
            <Text className="mt-2 text-2xl font-bold text-foreground" numberOfLines={2}>
              {String(release.title || 'Untitled')}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {artist?.name || 'Unknown artist'}
              {release.release_date ? ` · Release ${fmtDate(String(release.release_date))}` : ''}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'} · {entries.length} planned day
              {entries.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>

      {!campaigns.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No campaigns linked to this release yet."
          description="Create a campaign and select this release to populate the calendar."
          action={<Button label="Create Campaign" onPress={() => router.push('/create')} />}
        />
      ) : !entries.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No campaign days planned yet."
          description="Generate or open a campaign plan to add days — they will appear here automatically."
          action={
            <Button
              label="Open Campaign Plan"
              onPress={() => router.push(`/campaigns/${campaigns[0].id}?tab=plan`)}
            />
          }
        />
      ) : (
        <>
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row items-center gap-1">
              <Button variant="outline" onPress={() => setMonth((m) => addMonths(m, -1))}>
                <ChevronLeft color="#64748b" size={18} />
              </Button>
              <Text className="min-w-[10rem] text-center text-lg font-semibold text-foreground">{fmtMonthYear(month)}</Text>
              <Button variant="outline" onPress={() => setMonth((m) => addMonths(m, 1))}>
                <ChevronRight color="#64748b" size={18} />
              </Button>
            </View>
            <Button variant="outline" label="Today" onPress={() => setMonth(startOfMonth(new Date()))} />
          </View>

          <View className="gap-3">
            {releaseDate &&
            parseDateOnly(releaseDate)?.getFullYear() === month.getFullYear() &&
            parseDateOnly(releaseDate)?.getMonth() === month.getMonth() ? (
              <View className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-accent">Release Day</Text>
                <Text className="mt-0.5 text-sm font-semibold text-foreground">{fmtDate(releaseDate)}</Text>
              </View>
            ) : null}

            {monthEntries.length === 0 ? (
              <Text className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No campaign days in {fmtMonthYear(month)}.
              </Text>
            ) : (
              groupByDate(monthEntries).map(([date, list]) => (
                <View key={date} className="rounded-2xl border border-border bg-card/50 p-3">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-foreground">{fmtDate(date)}</Text>
                    {releaseDate === date ? (
                      <Text className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                        Release Day
                      </Text>
                    ) : null}
                  </View>
                  {list.map((entry) => (
                    <View key={String(entry.id)} className="mb-3 gap-2">
                      <Pressable
                        onPress={() => openEntry(entry)}
                        className="flex-row items-start gap-3 rounded-xl border border-border bg-muted/30 p-3"
                      >
                        <View
                          className="mt-1 h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: platformColor(String(entry.platform || '')) }}
                        />
                        <View className="min-w-0 flex-1">
                          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                            {String(entryTitle(entry))}
                          </Text>
                          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                            {String(entry.campaign_name || '')}
                            {entry.platform ? ` · ${entry.platform}` : ''}
                          </Text>
                          <View className="mt-1.5">
                            <StatusBadge status={String(entry.status || 'planned')} />
                          </View>
                        </View>
                      </Pressable>
                      <View className="flex-row flex-wrap gap-2 pl-5">
                        <Button variant="outline" label="View Day" onPress={() => openEntry(entry)} />
                        <Button label="View Content" onPress={() => openContent(entry)} />
                        <Button variant="outline" label="Post to Social" onPress={() => openSocial(entry)} />
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
