import { useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  bulkAutoPublishCampaignDays,
  countSchedulableDays,
  defaultBulkPostingTime,
} from "@/services/launchAutoPublish";
import { detectBrowserTimeZone, timeZoneShortLabel } from "@/lib/userTimezone";

export default function LaunchBoardAutoPublish({ days = [], onComplete, disabled }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const schedulable = useMemo(() => countSchedulableDays(days), [days]);
  const [postingTime, setPostingTime] = useState(() => defaultBulkPostingTime(days));
  const tzLabel = timeZoneShortLabel(detectBrowserTimeZone());

  const openDialog = (nextOpen) => {
    if (nextOpen) setPostingTime(defaultBulkPostingTime(days));
    setOpen(nextOpen);
  };

  const run = async () => {
    if (!schedulable) {
      toast({ variant: "destructive", title: "No days to schedule", description: "Add a campaign plan first." });
      return;
    }
    setBusy(true);
    try {
      const result = await bulkAutoPublishCampaignDays(days, postingTime);
      if (result.scheduled > 0) {
        toast({
          title: "Auto-publish enabled",
          description: `${result.scheduled} day(s) queued at ${postingTime} ${tzLabel} on each plan date.`,
        });
        setOpen(false);
        onComplete?.();
      } else {
        toast({
          variant: "destructive",
          title: "Could not schedule",
          description:
            result.errors[0] ||
            "Connect TikTok, Instagram, or YouTube in Social Hub, then try again.",
        });
      }
      if (result.failed && result.scheduled > 0) {
        toast({
          title: "Some days failed",
          description: `${result.failed} day(s) could not be scheduled.`,
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Auto-publish failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          disabled={disabled || schedulable === 0}
          data-tour="launch-auto-publish"
        >
          <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
          Auto-publish all
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-publish all plan days</DialogTitle>
          <DialogDescription>
            Pick one daily time. Each campaign day keeps its own calendar date and publishes at this time
            in {tzLabel}. We update posting time and queue auto-publish for {schedulable} day
            {schedulable === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="launch-bulk-time">Publish time</Label>
          <Input
            id="launch-bulk-time"
            type="time"
            value={postingTime}
            onChange={(e) => setPostingTime(e.target.value)}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Times use your device timezone ({tzLabel}). Already posted or in-progress days are skipped.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" disabled={busy} onClick={run}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Schedule {schedulable} day{schedulable === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
