import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  ListMusic,
  Sparkles,
  UserCircle,
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
  isOnboardingTutorialComplete,
  markOnboardingTutorialComplete,
} from "@/services/onboardingTutorial";

export const ONBOARDING_SHOW_EVENT = "musicpromo:show-onboarding-tutorial";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to MusicPromo AI",
    body: "MusicPromo AI is built for promotion: turn your release into a day-by-day plan with hooks, captions, promo videos, and scheduled posts — not AI song generation.",
    icon: Sparkles,
  },
  {
    id: "profile",
    title: "Claim your @handle",
    body: "Tap your name in the menu to open your profile. Use the edit (pen) button to set a unique @handle, photo, and bio so other artists can find you in Community.",
    icon: UserCircle,
    cta: { label: "Open your profile", to: "/profile" },
  },
  {
    id: "social",
    title: "Connect social accounts first",
    body: "Before auto-scheduling or publishing, connect at least one of TikTok, Instagram, or YouTube under Social → Connect. You can still build campaigns without this, but posts will not go live until accounts are linked.",
    icon: Link2,
    cta: { label: "Open Social Connect", to: "/social/connect" },
  },
  {
    id: "campaign",
    title: "Create your first promo",
    body: "New promo walks you through release → audio → optional lyrics/SRT → AI promo videos (best hook clip) → picking platforms for each plan day.",
    icon: ListMusic,
    cta: { label: "Start new promo", to: "/create" },
  },
  {
    id: "ready",
    title: "You're set to explore",
    body: "After generation, review the Plan tab, render promos in Videos, and turn on auto-schedule when you're ready. Analytics fills in as you post and track performance.",
    icon: CheckCircle2,
  },
];

export default function FirstLoginTutorial() {
  const { isAuthenticated, user, authPulse } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [skipOpen, setSkipOpen] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setChecking(false);
      setVisible(false);
      return undefined;
    }

    let cancelled = false;
    setChecking(true);
    isOnboardingTutorialComplete(user.id).then((done) => {
      if (cancelled) return;
      setChecking(false);
      if (!done) {
        const delay = authPulse ? 720 : 400;
        window.setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, delay);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, authPulse]);

  useEffect(() => {
    const onReplay = () => {
      setStepIndex(0);
      setVisible(true);
    };
    window.addEventListener(ONBOARDING_SHOW_EVENT, onReplay);
    return () => window.removeEventListener(ONBOARDING_SHOW_EVENT, onReplay);
  }, []);

  const closeAndPersist = useCallback(async () => {
    setVisible(false);
    setSkipOpen(false);
    if (user?.id) await markOnboardingTutorialComplete(user.id);
  }, [user?.id]);

  const onFinish = () => {
    closeAndPersist();
  };

  const onSkipConfirm = () => {
    closeAndPersist();
  };

  if (!isAuthenticated || checking || !visible) return null;

  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex >= STEPS.length - 1;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[45] flex items-end justify-center p-4 sm:items-end sm:justify-end sm:p-6"
        role="presentation"
      >
        <div
          className="pointer-events-auto w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-tutorial-title"
        >
          <div className="glass-bar surface overflow-hidden rounded-3xl border border-border/60 shadow-[var(--shadow-elevated)]">
            <div className="relative bg-gradient-to-br from-primary/15 via-transparent to-transparent px-5 pb-1 pt-5">
              <button
                type="button"
                onClick={() => setSkipOpen(true)}
                className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                aria-label="Skip tutorial"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-primary/90">
                    Quick setup · Step {stepIndex + 1} of {STEPS.length}
                  </p>
                  <h2 id="onboarding-tutorial-title" className="font-heading text-lg font-semibold leading-snug">
                    {step.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>

              {step.cta ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full rounded-full"
                  onClick={() => navigate(step.cta.to)}
                >
                  {step.cta.label}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : null}

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
                  Skip for now
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
                    <Button type="button" className="rounded-full" onClick={onFinish}>
                      Get started
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
                Need this again later?{" "}
                <Link to="/settings/preferences" className="text-primary underline-offset-2 hover:underline">
                  Settings → Preferences
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={skipOpen} onOpenChange={setSkipOpen}>
        <AlertDialogContent className="rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Skip the setup tour?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              We recommend finishing this short tour so you know to connect social accounts and upload artwork
              and audio before your first campaign. It only takes a minute and you will not see it again after
              you skip or complete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="rounded-full">Continue tutorial</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={onSkipConfirm}>
              Skip anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
