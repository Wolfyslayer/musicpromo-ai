import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Link2,
  ListChecks,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import {
  isReleaseLaunchTourComplete,
  markReleaseLaunchTourComplete,
  RELEASE_LAUNCH_TOUR_SHOW_EVENT,
} from "@/services/releaseLaunchTour";

const STEPS = [
  {
    id: "welcome",
    title: "Your release command center",
    body: "This board is the home base for launch week: every campaign day, schedule state, and fix in one timeline.",
    icon: Sparkles,
    highlight: null,
  },
  {
    id: "connections",
    title: "Connect before you queue",
    body: "Link TikTok, Instagram, or YouTube first. Auto-publish and quick post from a day need an active connection.",
    icon: Link2,
    highlight: "[data-tour='launch-connections']",
  },
  {
    id: "timeline",
    title: "Tap any day",
    body: "Open a day to preview the post, queue auto-publish, publish now when overdue, or edit caption inline.",
    icon: CalendarClock,
    highlight: "[data-tour='launch-timeline']",
  },
  {
    id: "checklist",
    title: "Release checklist",
    body: "Use the checklist to see what's left — videos, scheduled days, and social health — before release day.",
    icon: ListChecks,
    highlight: "[data-tour='launch-checklist']",
  },
  {
    id: "daily-claim",
    title: "Daily credits",
    body: "Your credit balance is in the header — tap it for plans and top-ups. Tap 🎁 to claim free daily credits (day 3 and day 7 pay bonuses each month).",
    icon: Sparkles,
    highlight: "[data-tour='daily-claim-gift']",
  },
  {
    id: "ready",
    title: "You're ready to launch",
    body: "Start by tapping today's day, queue auto-publish when copy looks good, and watch the timeline turn green as posts go live.",
    icon: CheckCircle2,
    highlight: null,
  },
];

export default function ReleaseLaunchTour({ releaseId, hasTimelineDays }) {
  const { isAuthenticated, user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [skipOpen, setSkipOpen] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !releaseId || !hasTimelineDays) {
      setChecking(false);
      setVisible(false);
      return undefined;
    }

    let cancelled = false;
    setChecking(true);
    isReleaseLaunchTourComplete(user.id, releaseId).then((done) => {
      if (cancelled) return;
      setChecking(false);
      if (!done) {
        window.setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 600);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasTimelineDays, isAuthenticated, releaseId, user?.id]);

  useEffect(() => {
    const onReplay = (e) => {
      if (e?.detail?.releaseId && e.detail.releaseId !== releaseId) return;
      setStepIndex(0);
      setVisible(true);
    };
    window.addEventListener(RELEASE_LAUNCH_TOUR_SHOW_EVENT, onReplay);
    return () => window.removeEventListener(RELEASE_LAUNCH_TOUR_SHOW_EVENT, onReplay);
  }, [releaseId]);

  const closeAndPersist = useCallback(async () => {
    setVisible(false);
    setSkipOpen(false);
    if (user?.id && releaseId) await markReleaseLaunchTourComplete(user.id, releaseId);
  }, [releaseId, user?.id]);

  const step = STEPS[stepIndex];
  const isLast = stepIndex >= STEPS.length - 1;

  useEffect(() => {
    if (!visible || !step?.highlight) return undefined;
    const el = document.querySelector(step.highlight);
    if (!el) return undefined;
    el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-xl");
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return () => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-xl");
    };
  }, [step?.highlight, stepIndex, visible]);

  if (!isAuthenticated || checking || !visible || !hasTimelineDays) return null;

  const Icon = step.icon;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[44] flex items-end justify-center p-4 sm:items-end sm:justify-end sm:p-6"
        role="presentation"
      >
        <div
          className="pointer-events-auto w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="release-launch-tour-title"
        >
          <div className="glass-bar surface overflow-hidden rounded-3xl border border-border/60 shadow-[var(--shadow-elevated)]">
            <div className="relative bg-gradient-to-br from-violet-500/15 via-transparent to-transparent px-5 pb-1 pt-5">
              <button
                type="button"
                onClick={() => setSkipOpen(true)}
                className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                aria-label="Skip tour"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-violet-600/90 dark:text-violet-300/90">
                    Launch tour · Step {stepIndex + 1} of {STEPS.length}
                  </p>
                  <h2 id="release-launch-tour-title" className="font-heading text-lg font-semibold leading-snug">
                    {step.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>

              <div className="flex items-center justify-center gap-1.5 pt-1">
                {STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === stepIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full text-muted-foreground"
                  onClick={() => setSkipOpen(true)}
                >
                  Skip
                </Button>
                <div className="flex gap-2">
                  {stepIndex > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                    >
                      Back
                    </Button>
                  ) : null}
                  {isLast ? (
                    <Button type="button" className="rounded-full" onClick={closeAndPersist}>
                      Launch
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="rounded-full"
                      onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-center text-[11px] text-muted-foreground/80">
                <Link to="/settings/preferences" className="text-primary underline-offset-2 hover:underline">
                  Settings
                </Link>{" "}
                · replay from Preferences later
              </p>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={skipOpen} onOpenChange={setSkipOpen}>
        <AlertDialogContent className="rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Skip the launch tour?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              This short walkthrough only appears once per release. You can still manage days from the timeline anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="rounded-full">Continue tour</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={closeAndPersist}>
              Skip anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
