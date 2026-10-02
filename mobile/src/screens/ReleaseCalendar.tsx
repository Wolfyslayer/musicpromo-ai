import { addMonths, startOfMonth } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import ArtworkImage from '@/components/ArtworkImage';
import EmptyState from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { platformColor } from '@/services/constants';
import { loadReleaseCalendar } from '@/services/data';
import { fmtDate, fmtMonthYear, parseDateOnly, toDateOnlyISO, todayISO } from '@/services/format';
import { buildComposePath } from '@/services/socialService';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function buildMonthWeeks(monthDate: Date) {
  const first = startOfMonth(monthDate);
  const mondayOffset = (first.getDay() + 6) % 7;
  const weeks: { date: Date; iso: string; inMonth: boolean }[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: { date: Date; iso: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset + w * 7 + i);
      row.push({ date: d, iso: toDateOnlyISO(d) as string, inMonth: d.getMonth() === monthDate.getMonth() });
    }
    weeks.push(row);
  }
  return weeks;
}

function entryTitle(entry: any) {
  return entry.content_type || entry.objective || entry.hook || `Day ${entry.day_number || ''}`.trim() || 'Campaign day';
}

function groupByDate(entries: any[]) {
  const map: Record<string, any[]> = {};
  for (const e of entries) {
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

function ReleaseDayTag({ label = 'Release Day' }: { label?: string }) {
  return (
    <View className="rounded-full bg-accent/20 px-2 py-0.5">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-accent">{label}</Text>
    </View>
  );
}

function EntryRow({ entry, onView, onContent, onPost }: { entry: any; onView: () => void; onContent: () => void; onPost: () => void }) {
  return (
    <View className="gap-2">
      <Pressable onPress={onView} className="flex-row items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 active:border-primary/40">
        <View className="mt-1 size-2.5 rounded-full" style={{ backgroundColor: platformColor(entry.platform) }} />
        <View className="flex-1">
          <Text className="text-sm font-semibold" numberOfLines={1}>
            {entryTitle(entry)}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {entry.campaign_name}
            {entry.platform ? ` · ${entry.platform}` : ''}
          </Text>
          <View className="mt-1.5">
            <StatusBadge status={entry.status || 'planned'} />
          </View>
        </View>
      </Pressable>
      <View className="flex-row flex-wrap gap-2 pl-5">
        <Button size="sm" variant="outline" className="rounded-full" onPress={onView}>
          View Day
        </Button>
        <Button size="sm" className="rounded-full" onPress={onContent}>
          View Content
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onPress={onPost}>
          Post to Social
        </Button>
      </View>
    </View>
  );
}

export default function ReleaseCalendar() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [monthReady, setMonthReady] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    setError('');
    setData(null);
    setMonthReady(false);
    setSelectedDay(null);
    loadReleaseCalendar(id)
      .then((result: any) => {
        setData(result);
        const releaseDay = parseDateOnly(result.release?.release_date);
        setMonth(startOfMonth(releaseDay || new Date()));
        setMonthReady(true);
      })
      .catch((e: any) => {
        setError(e.message || 'Failed to load calendar');
        setMonthReady(true);
      });
  }, [id]);

  const today = todayISO();
  const releaseDate = data?.release?.release_date || null;

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const entry of data?.entries || []) {
      if (!entry.date) continue;
      if (!map[entry.date]) map[entry.date] = [];
      map[entry.date].push(entry);
    }
    return map;
  }, [data]);

  const weeks = useMemo(() => buildMonthWeeks(month), [month]);

  const monthEntries = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    return (data?.entries || []).filter((e: any) => {
      const d = parseDateOnly(e.date);
      return d && d.getFullYear() === y && d.getMonth() === m;
    });
  }, [data, month]);

  const openEntry = (entry: any) => {
    if (!entry?.campaign_id) return;
    setSelectedDay(null);
    router.push(`/campaigns/${entry.campaign_id}?tab=plan`);
  };

  const openContent = (entry: any) => {
    if (!entry?.campaign_id) return;
    setSelectedDay(null);
    router.push(`/campaigns/${entry.campaign_id}/content?day=${entry.id}`);
  };

  const openSocial = (entry: any) => {
    if (!entry?.campaign_id) return;
    setSelectedDay(null);
    router.push(buildComposePath({ campaignId: entry.campaign_id, campaignDayId: entry.id, releaseId: id }) as any);
  };

  const renderEntry = (entry: any) => (
    <EntryRow key={entry.id} entry={entry} onView={() => openEntry(entry)} onContent={() => openContent(entry)} onPost={() => openSocial(entry)} />
  );

  if (error) {
    return (
      <Screen contentClassName="gap-4">
        <Pressable onPress={() => router.replace('/releases')} className="flex-row items-center gap-1.5 self-start py-1">
          <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
          <Text className="text-sm text-muted-foreground">Back to releases</Text>
        </Pressable>
        <Text className="text-destructive">{error}</Text>
      </Screen>
    );
  }

  if (!data || !monthReady) {
    return (
      <Screen>
        <Skeleton className="h-64 rounded-2xl" />
      </Screen>
    );
  }

  const { release, artist, campaigns, entries } = data;
  const releaseMonthDay = releaseDate ? parseDateOnly(releaseDate) : null;
  const releaseInMonth = !!releaseMonthDay && releaseMonthDay.getFullYear() === month.getFullYear() && releaseMonthDay.getMonth() === month.getMonth();
  const selectedEntries = selectedDay ? byDate[selectedDay] || [] : [];

  return (
    <Screen contentClassName="gap-5">
      <Pressable onPress={() => router.replace(`/releases/${id}`)} className="flex-row items-center gap-1.5 self-start py-1">
        <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
        <Text className="text-sm text-muted-foreground">Back to Release</Text>
      </Pressable>

      <View className="flex-row gap-4 rounded-3xl border border-border bg-card p-5">
        <ArtworkImage src={release.artwork_url} alt={release.title} className="size-24" rounded="rounded-2xl" />
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusBadge status={release.status || 'draft'} />
            <View className="rounded-full border border-border bg-muted/40 px-2 py-0.5">
              <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">Campaign Calendar</Text>
            </View>
          </View>
          <Text className="mt-2 font-heading-bold text-xl" numberOfLines={2}>
            {release.title || 'Untitled'}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {artist?.name || 'Unknown artist'}
            {release.release_date ? ` · Release ${fmtDate(release.release_date)}` : ''}
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'} · {entries.length} planned day{entries.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {!campaigns.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No campaigns linked to this release yet."
          description="Create a campaign and select this release to populate the calendar."
          action={
            <Button onPress={() => router.push('/create')} className="rounded-full">
              Create Campaign
            </Button>
          }
        />
      ) : !entries.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No campaign days planned yet."
          description="Generate or open a campaign plan to add days — they will appear here automatically."
          action={
            <Button onPress={() => router.push(`/campaigns/${campaigns[0].id}?tab=plan`)} className="rounded-full">
              Open Campaign Plan
            </Button>
          }
        />
      ) : (
        <>
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-1">
              <Button variant="outline" size="icon" className="size-10 rounded-full" accessibilityLabel="Previous month" onPress={() => setMonth((m) => addMonths(m, -1))}>
                <Icon as={ChevronLeft} size={16} className="text-foreground" />
              </Button>
              <Text className="min-w-[8rem] flex-1 text-center font-heading text-base">{fmtMonthYear(month)}</Text>
              <Button variant="outline" size="icon" className="size-10 rounded-full" accessibilityLabel="Next month" onPress={() => setMonth((m) => addMonths(m, 1))}>
                <Icon as={ChevronRight} size={16} className="text-foreground" />
              </Button>
            </View>
            <Button variant="outline" className="rounded-full" onPress={() => setMonth(startOfMonth(new Date()))}>
              Today
            </Button>
          </View>

          <View className="overflow-hidden rounded-2xl border border-border bg-card/40">
            <View className="flex-row border-b border-border bg-muted/30">
              {WEEKDAYS.map((d) => (
                <View key={d} className="flex-1 items-center py-2">
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</Text>
                </View>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} className={cn('flex-row', wi < weeks.length - 1 && 'border-b border-border/40')}>
                {week.map((cell, ci) => {
                  const dayEntries = byDate[cell.iso] || [];
                  const isReleaseDay = !!releaseDate && cell.iso === releaseDate;
                  const isToday = cell.iso === today;
                  const interactive = dayEntries.length > 0 || isReleaseDay;
                  return (
                    <Pressable
                      key={cell.iso}
                      disabled={!interactive}
                      onPress={() => setSelectedDay(cell.iso)}
                      className={cn(
                        'h-14 flex-1 items-center gap-1 p-1',
                        ci < 6 && 'border-r border-border/40',
                        !cell.inMonth && 'bg-muted/10',
                        isReleaseDay && 'bg-accent/15'
                      )}>
                      <View className={cn('size-6 items-center justify-center rounded-full', isToday && 'bg-primary')}>
                        <Text className={cn('text-xs font-semibold', isToday ? 'text-primary-foreground' : cell.inMonth ? 'text-foreground' : 'text-muted-foreground/50')}>
                          {cell.date.getDate()}
                        </Text>
                      </View>
                      <View className="h-2 flex-row items-center gap-0.5">
                        {dayEntries.slice(0, 3).map((entry) => (
                          <View key={entry.id} className="size-1.5 rounded-full" style={{ backgroundColor: platformColor(entry.platform) }} />
                        ))}
                        {dayEntries.length > 3 ? <Text className="text-[8px] text-muted-foreground">+{dayEntries.length - 3}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View className="gap-3">
            {releaseInMonth ? (
              <View className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-accent">Release Day</Text>
                <Text className="mt-0.5 text-sm font-semibold">{fmtDate(releaseDate)}</Text>
              </View>
            ) : null}

            {monthEntries.length === 0 ? (
              <Text className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No campaign days in {fmtMonthYear(month)}.</Text>
            ) : (
              groupByDate(monthEntries).map(([date, list]) => (
                <View key={date} className="rounded-2xl border border-border bg-card/50 p-3">
                  <View className="mb-2 flex-row items-center justify-between gap-2">
                    <Text className="text-sm font-semibold">{fmtDate(date)}</Text>
                    {releaseDate === date ? <ReleaseDayTag /> : null}
                  </View>
                  <View className="gap-3">{list.map(renderEntry)}</View>
                </View>
              ))
            )}
          </View>
        </>
      )}

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)} variant="sheet" title={selectedDay ? fmtDate(selectedDay) : undefined}>
        <View className="gap-3 pb-2">
          {selectedDay && releaseDate === selectedDay ? (
            <View className="self-start">
              <ReleaseDayTag />
            </View>
          ) : null}
          {selectedEntries.map(renderEntry)}
          {selectedEntries.length === 0 ? <Text className="text-sm text-muted-foreground">No campaign days planned for this date.</Text> : null}
        </View>
      </Dialog>
    </Screen>
  );
}
