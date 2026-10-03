import { ChevronRight } from "lucide-react";
import DayStatusChip from "@/components/ux/DayStatusChip";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/services/format";
import { platformColor } from "@/services/constants";

export default function LaunchTimelineDayRow({ item, onManageDay }) {
  const day = item.day;
  const campaign = item.campaign;
  const posts = item.posts || [];

  return (
    <button
      type="button"
      onClick={() => onManageDay?.(item)}
      className="w-full rounded-xl border border-border/50 p-3 text-left transition hover:border-primary/35 hover:bg-muted/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {fmtDate(item.date)} · Day {day.day_number ?? "—"} · {campaign?.name || "Campaign"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-500">{day.caption || day.theme || "No caption yet"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DayStatusChip day={day} posts={posts} />
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-600"
              style={{
                background: `${platformColor(day.platform)}22`,
                color: platformColor(day.platform),
              }}
            >
              {day.platform}
            </span>
            {day.scheduled_at ? (
              <span className="text-[10px] text-muted-foreground">
                {new Date(day.scheduled_at).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" className="pointer-events-none rounded-full">
          Manage
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </button>
  );
}
