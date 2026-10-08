import { Link } from "react-router-dom";
import { Disc3, Film, FileText, Share2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Release",
    description: "Single, EP, or album — artwork, tracks, and release date.",
    to: "/create",
    cta: "Start wizard",
    icon: Disc3,
  },
  {
    title: "Audio & lyrics",
    description: "Upload masters, optionally add lyrics or .srt for smarter hook clips.",
    to: "/create",
    cta: "Continue setup",
    icon: FileText,
  },
  {
    title: "Promo videos",
    description: "AI plans your rollout and encodes the best part of each song.",
    to: "/create",
    cta: "Create videos",
    icon: Film,
  },
  {
    title: "Platforms",
    description: "Pick where each plan day publishes, then launch.",
    to: "/social/connect",
    cta: "Connect social",
    icon: Share2,
  },
];

export default function PromoPathCards({ className }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-gradient-to-br from-primary/[0.06] via-card/80 to-card/60 p-3 sm:p-4",
        className
      )}
    >
      <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">How it works</p>
      <div className="segmented-scroll">
        <div className="flex min-w-max gap-2.5 sm:grid sm:min-w-0 sm:w-full sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.title}
                to={step.to}
                className="group flex w-[min(100%,15.5rem)] shrink-0 flex-col rounded-2xl border border-border/40 bg-background/75 p-3.5 transition hover:border-primary/35 hover:bg-background hover:shadow-[var(--shadow-soft)] sm:w-auto"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/12 text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground">
                    {index + 1}
                  </span>
                </div>
                <h3 className="font-heading text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-0.5 line-clamp-2 flex-1 text-xs leading-snug text-muted-foreground">{step.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-600 text-primary">
                  {step.cta}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
