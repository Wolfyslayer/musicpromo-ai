import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

import { loadReleaseCalendar } from "@/services/data";
import { buildComposePath } from "@/services/socialService";
import { fmtDate, fmtMonthYear, parseDateOnly, toDateOnlyISO, todayISO } from "@/services/format";
import { platformColor } from "@/services/constants";
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

export default function ReleaseCalendar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [monthReady, setMonthReady] = useState(false);

  useEffect(() => {
    setError("");
    setData(null);
    setMonthReady(false);
    loadReleaseCalendar(id)
      .then((result) => {
        setData(result);
        const releaseDay = parseDateOnly(result.release?.release_date);
        setMonth(startOfMonth(releaseDay || new Date()));
        setMonthReady(true);
      })
      .catch((e) => {
        setError(e.message || "Failed to load calendar");
        setMonthReady(true);
      });
  }, [id]);

  const today = todayISO();
  const releaseDate = data?.release?.release_date || null;

  const byDate = useMemo(() => {
    const map = {};
    for (const entry of data?.entries || []) {
      if (!entry.date) continue;
      if (!map[entry.date]) map[entry.date] = [];
      map[entry.date].push(entry);
    }
    return map;
  }, [data]);

  const cells = useMemo(() => buildMonthCells(month), [month]);

  const monthEntries = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    return (data?.entries || []).filter((e) => {
      const d = parseDateOnly(e.date);
      return d && d.getFullYear() === y && d.getMonth() === m;
    });
  }, [data, month]);

  const openEntry = (entry) => {
    if (!entry?.campaign_id) return;
    navigate(`/campaigns/${entry.campaign_id}/plan`);
  };

  const openContent = (entry) => {
    if (!entry?.campaign_id) return;
    navigate(`/campaigns/${entry.campaign_id}/content?day=${entry.id}`);
  };

  const openSocial = (entry) => {
    if (!entry?.campaign_id) return;
    navigate(
      buildComposePath({
        campaignId: entry.campaign_id,
        campaignDayId: entry.id,
        releaseId: id,
      })
    );
  };

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate("/releases")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to releases
        </button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data || !monthReady) return <div className="h-64 animate-shimmer rounded-2xl" />;

  const { release, artist, campaigns, entries } = data;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(`/releases/${id}`)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Release
      </button>

      <div className="overflow-hidden rounded-3xl border border-border/60 surface">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <ArtworkImage
            src={release.artwork_url}
            alt={release.title}
            className="h-28 w-28 shrink-0"
            rounded="rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={release.status || "draft"} />
              <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Campaign Calendar
              </span>
            </div>
            <h1 className="mt-2 truncate font-heading text-2xl font-semibold">{release.title || "Untitled"}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {artist?.name || "Unknown artist"}
              {release.release_date ? ` · Release ${fmtDate(release.release_date)}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} · {entries.length} planned day{entries.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      {!campaigns.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No campaigns linked to this release yet."
          description="Create a campaign and select this release to populate the calendar."
          action={
            <Button onClick={() => navigate("/create")} className="rounded-full">
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
            <Button onClick={() => navigate(`/campaigns/${campaigns[0].id}/plan`)} className="rounded-full">
              Open Campaign Plan
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label="Previous month"
                onClick={() => setMonth((m) => addMonths(m, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-[10rem] text-center font-heading text-base font-600 sm:text-lg">
                {fmtMonthYear(month)}
              </h2>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label="Next month"
                onClick={() => setMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setMonth(startOfMonth(new Date()))}
            >
              Today
            </Button>
          </div>

          {/* Desktop / tablet month grid */}
          <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card/40 sm:block">
            <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[11px] font-600 uppercase tracking-wider text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell) => {
                const dayEntries = byDate[cell.iso] || [];
                const isReleaseDay = releaseDate && cell.iso === releaseDate;
                const isToday = cell.iso === today;
                return (
                  <div
                    key={cell.iso}
                    className={`min-h-[6.5rem] border-b border-r border-border/40 p-1.5 ${
                      cell.inMonth ? "bg-transparent" : "bg-muted/10"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full text-xs font-600 ${
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : cell.inMonth
                              ? "text-foreground"
                              : "text-muted-foreground/50"
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {isReleaseDay && (
                        <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
                          Release
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayEntries.slice(0, 3).map((entry) => (
                        <div key={entry.id} className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => openEntry(entry)}
                            className="block w-full truncate rounded-md border border-border/50 bg-muted/40 px-1.5 py-1 text-left text-[10px] leading-tight transition hover:border-primary/40 hover:bg-primary/10"
                            title={`${entryTitle(entry)} · ${entry.campaign_name}`}
                          >
                            <span className="font-600">{entryTitle(entry)}</span>
                            <span className="mt-0.5 block truncate text-muted-foreground">{entry.campaign_name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openContent(entry)}
                            className="w-full rounded px-1 py-0.5 text-left text-[9px] font-600 uppercase tracking-wider text-primary hover:underline"
                          >
                            Content
                          </button>
                          <button
                            type="button"
                            onClick={() => openSocial(entry)}
                            className="w-full rounded px-1 py-0.5 text-left text-[9px] font-600 uppercase tracking-wider text-primary hover:underline"
                          >
                            Post
                          </button>
                        </div>
                      ))}
                      {dayEntries.length > 3 && (
                        <p className="px-1 text-[10px] text-muted-foreground">+{dayEntries.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile agenda for the month */}
          <div className="space-y-3 sm:hidden">
            {releaseDate && parseDateOnly(releaseDate)?.getFullYear() === month.getFullYear()
              && parseDateOnly(releaseDate)?.getMonth() === month.getMonth() && (
              <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Release Day</p>
                <p className="mt-0.5 text-sm font-600">{fmtDate(releaseDate)}</p>
              </div>
            )}

            {monthEntries.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No campaign days in {fmtMonthYear(month)}.
              </p>
            ) : (
              groupByDate(monthEntries).map(([date, list]) => (
                <div key={date} className="rounded-2xl border border-border/60 bg-card/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-600">{fmtDate(date)}</p>
                    {releaseDate === date && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                        Release Day
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {list.map((entry) => (
                      <div key={entry.id} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => openEntry(entry)}
                          className="flex w-full items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-3 text-left transition hover:border-primary/40"
                        >
                          <span
                            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: platformColor(entry.platform) }}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-600">{entryTitle(entry)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {entry.campaign_name}
                              {entry.platform ? ` · ${entry.platform}` : ""}
                            </p>
                            <div className="mt-1.5">
                              <StatusBadge status={entry.status || "planned"} />
                            </div>
                          </div>
                        </button>
                        <div className="flex flex-wrap gap-2 pl-5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-full"
                            onClick={() => openEntry(entry)}
                          >
                            View Day
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 rounded-full"
                            onClick={() => openContent(entry)}
                          >
                            View Content
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-full"
                            onClick={() => openSocial(entry)}
                          >
                            Post to Social
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function groupByDate(entries) {
  const map = {};
  for (const e of entries) {
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}
