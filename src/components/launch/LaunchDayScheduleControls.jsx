import { useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  dayToLocalDatetimeValue,
  localDatetimeToIso,
  scheduledAtToLocalValue,
} from "@/lib/campaignDaySchedule";
import { scheduleCampaignDay } from "@/services/socialService";

export default function LaunchDayScheduleControls({ day, onScheduled }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const initial =
    scheduledAtToLocalValue(day.scheduled_at) || dayToLocalDatetimeValue(day) || "";
  const [when, setWhen] = useState(initial);

  const isScheduled = ["scheduled", "processing", "posted", "complete"].includes(
    String(day.status || "")
  );

  const runSchedule = async () => {
    const iso = localDatetimeToIso(when) || localDatetimeToIso(dayToLocalDatetimeValue(day));
    if (!iso) {
      toast({ variant: "destructive", title: "Pick a date and time" });
      return;
    }
    setBusy(true);
    try {
      const res = await scheduleCampaignDay({ campaignDayId: day.id, scheduledAt: iso });
      if (!res?.ok) {
        toast({
          variant: "destructive",
          title: isScheduled ? "Could not reschedule" : "Could not schedule",
          description: res?.error || "Connect social accounts in Social Hub.",
        });
        return;
      }
      toast({
        title: isScheduled ? "Rescheduled" : "Scheduled",
        description: res.message || new Date(res.scheduledAt).toLocaleString(),
      });
      onScheduled?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Schedule failed",
        description: e.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border/40 bg-muted/15 p-3">
      <div className="flex items-center gap-2 text-xs font-600 text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {isScheduled ? "Reschedule auto-publish" : "Schedule auto-publish"}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-xs">Go-live time</Label>
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <Button type="button" size="sm" className="rounded-full" disabled={busy} onClick={runSchedule}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isScheduled ? "Update schedule" : "Schedule"}
        </Button>
      </div>
    </div>
  );
}
