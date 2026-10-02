import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { loadReleaseCalendar } from "@/services/data";
import { buildComposePath } from "@/services/socialService";
import { fmtDate, fmtMonthYear, parseDateOnly, toDateOnlyISO, todayISO } from "@/services/format";
import { platformColor } from "@/services/constants";
import { cn } from "@/lib/utils";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { ErrorState, LoadingState, Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function buildMonthCells(monthDate) {
  const first = startOfMonth(monthDate);
  // Monday-first: JS getDay() Sun=0 … Sat=6 → Mon=0 … Sun=6
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

function entryTitle(entry) {
  return entry.content_type || entry.objective || entry.hook || `Day ${entry.day_number || ""}`.trim() || "Campaign day";
}

function groupByDate(entries) {
  const map = {};
  for (const e of entries) {
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export default function ReleaseCalendar() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["release-calendar", id, user?.id],
    queryFn: () => loadReleaseCalendar(id),
    enabled: Boolean(id),
  });
  const { refetch } = query;
  const reload = useCallback(() => refetch(), [refetch]);
  useWorkspaceRefresh(reload);

  if (query.isError) {
    return (
      <Screen onRefresh={reload} refreshing={query.isRefetching}>
        <ErrorState message={query.error?.message || "Failed to load calendar"} onRetry={reload} />
        <Button variant="ghost" onPress={() => router.replace("/releases")}>
          Back to releases
        </Button>
      </Screen>
    );
  }

  if (!query.data) return <LoadingState />;

  return <CalendarBody key={id} id={id} data={query.data} refreshing={query.isRefetching} onRefresh={reload} />;
}

function CalendarBody({ id, data, refreshing, onRefresh }) {
  const { release, artist, campaigns, entries } = data;
  const releaseDate = release?.release_date || null;
  const [month, setMonth] = useState(() => startOfMonth(parseDateOnly(releaseDate) || new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const today = todayISO();

  const byDate = useMemo(() => {
    const map = {};
    for (const entry of entries || []) {
      if (!entry.date) continue;
      if (!map[entry.date]) map[entry.date] = [];
      map[entry.date].push(entry);
    }
    return map;
  }, [entries]);

  const cells = useMemo(() => buildMonthCells(month), [month]);

  const monthEntries = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    return (entries || []).filter((e) => {
      const d = parseDateOnly(e.date);
      return d && d.getFullYear() === y && d.getMonth() === m;
    });
  }, [entries, month]);

  const changeMonth = (next) => {
    setMonth(next);
    setSelectedDay(null);
  };

  const openEntry = (entry) => {
    if (!entry?.campaign_id) return;
    router.push(`/campaigns/${entry.campaign_id}?tab=plan`);
  };

  const openContent = (entry) => {
    if (!entry?.campaign_id) return;
    router.push(`/campaigns/${entry.campaign_id}/content?day=${entry.id}`);
  };

  const openSocial = (entry) => {
    if (!entry?.campaign_id) return;
    router.push(buildComposePath({ campaignId: entry.campaign_id, campaignDayId: entry.id, releaseId: id }));
  };

  const releaseDay = parseDateOnly(releaseDate);
  const releaseInMonth =
    releaseDay && releaseDay.getFullYear() === month.getFullYear() && releaseDay.getMonth() === month.getMonth();

  const entryActions = { openEntry, openContent, openSocial };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View className="gap-4 overflow-hidden rounded-3xl border border-border/60 bg-card p-5">
        <ArtworkImage src={release.artwork_url} className="h-28 w-28" rounded="rounded-2xl" />
        <View>
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusBadge status={release.status || "draft"} />
            <View className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5">
              <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">Campaign Calendar</Text>
            </View>
          </View>
          <Text className="mt-2 font-heading text-2xl" numberOfLines={1}>
            {release.title || "Untitled"}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {artist?.name || "Unknown artist"}
            {release.release_date ? ` · Release ${fmtDate(release.release_date)}` : ""}
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} · {entries.length} planned day
            {entries.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      {!campaigns.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No campaigns linked to this release yet."
          description="Create a campaign and select this release to populate the calendar."
          action={
            <Button onPress={() => router.push("/create")} className="rounded-full">
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
            <View className="flex-row items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                icon={ChevronLeft}
                className="h-10 w-10 rounded-full"
                accessibilityLabel="Previous month"
                onPress={() => changeMonth(addMonths(month, -1))}
              />
              <Text className="min-w-[8.5rem] text-center font-heading-medium text-base">{fmtMonthYear(month)}</Text>
              <Button
                variant="outline"
                size="icon"
                icon={ChevronRight}
                className="h-10 w-10 rounded-full"
                accessibilityLabel="Next month"
                onPress={() => changeMonth(addMonths(month, 1))}
              />
            </View>
            <Button variant="outline" className="rounded-full" onPress={() => changeMonth(startOfMonth(new Date()))}>
              Today
            </Button>
          </View>

          <View className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            <View className="flex-row border-b border-border/50 bg-muted/30">
              {WEEKDAYS.map((d) => (
                <View key={d} className="w-[14.28%] py-2">
                  <Text className="text-center text-[10px] font-600 uppercase text-muted-foreground">{d}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {cells.map((cell) => {
                const dayEntries = byDate[cell.iso] || [];
                const isReleaseDay = releaseDate && cell.iso === releaseDate;
                const isToday = cell.iso === today;
                const isSelected = cell.iso === selectedDay;
                return (
                  <Pressable
                    key={cell.iso}
                    onPress={() => setSelectedDay(isSelected ? null : cell.iso)}
                    accessibilityLabel={`${fmtDate(cell.iso)}, ${dayEntries.length} entries`}
                    className={cn(
                      "h-14 w-[14.28%] items-center gap-1 border-b border-r border-border/30 pt-1.5 active:bg-muted",
                      !cell.inMonth && "bg-muted/10",
                      isSelected && "bg-primary/15",
                      isReleaseDay && !isSelected && "bg-accent/10"
                    )}
                  >
                    <View className={cn("h-6 w-6 items-center justify-center rounded-full", isToday && "bg-primary")}>
                      <Text
                        className={cn(
                          "text-xs font-600",
                          isToday ? "text-primary-foreground" : cell.inMonth ? "text-foreground" : "text-muted-foreground/50",
                          isReleaseDay && !isToday && "text-accent"
                        )}
                      >
                        {cell.date.getDate()}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-0.5">
                      {dayEntries.slice(0, 3).map((entry) => (
                        <View key={entry.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: platformColor(entry.platform) }} />
                      ))}
                      {dayEntries.length > 3 ? <Text className="text-[8px] text-muted-foreground">+{dayEntries.length - 3}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {selectedDay ? (
            <View className="gap-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="font-heading-medium text-base">{fmtDate(selectedDay)}</Text>
                <Button variant="ghost" size="sm" onPress={() => setSelectedDay(null)}>
                  Show whole month
                </Button>
              </View>
              {(byDate[selectedDay] || []).length === 0 && releaseDate !== selectedDay ? (
                <Text className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No campaign days on {fmtDate(selectedDay)}.
                </Text>
              ) : (
                <DayGroup date={selectedDay} list={byDate[selectedDay] || []} releaseDate={releaseDate} {...entryActions} />
              )}
            </View>
          ) : (
            <View className="gap-3">
              {releaseInMonth ? (
                <View className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3">
                  <Text className="text-[10px] font-700 uppercase tracking-wider text-accent">Release Day</Text>
                  <Text className="mt-0.5 text-sm font-600">{fmtDate(releaseDate)}</Text>
                </View>
              ) : null}

              {monthEntries.length === 0 ? (
                <Text className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No campaign days in {fmtMonthYear(month)}.
                </Text>
              ) : (
                groupByDate(monthEntries).map(([date, list]) => (
                  <DayGroup key={date} date={date} list={list} releaseDate={releaseDate} {...entryActions} />
                ))
              )}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function DayGroup({ date, list, releaseDate, openEntry, openContent, openSocial }) {
  return (
    <View className="rounded-2xl border border-border/60 bg-card/50 p-3">
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text className="text-sm font-600">{fmtDate(date)}</Text>
        {releaseDate === date ? (
          <View className="rounded-full bg-accent/20 px-2 py-0.5">
            <Text className="text-[10px] font-700 uppercase tracking-wider text-accent">Release Day</Text>
          </View>
        ) : null}
      </View>
      <View className="gap-2">
        {list.map((entry) => (
          <View key={entry.id} className="gap-2">
            <Pressable
              onPress={() => openEntry(entry)}
              className="flex-row items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-3 active:border-primary/40"
            >
              <View className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: platformColor(entry.platform) }} />
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-600" numberOfLines={1}>
                  {entryTitle(entry)}
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {entry.campaign_name}
                  {entry.platform ? ` · ${entry.platform}` : ""}
                </Text>
                <View className="mt-1.5">
                  <StatusBadge status={entry.status || "planned"} />
                </View>
              </View>
            </Pressable>
            <View className="flex-row flex-wrap gap-2 pl-5">
              <Button size="sm" variant="outline" className="rounded-full" onPress={() => openEntry(entry)}>
                View Day
              </Button>
              <Button size="sm" className="rounded-full" onPress={() => openContent(entry)}>
                View Content
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onPress={() => openSocial(entry)}>
                Post to Social
              </Button>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
