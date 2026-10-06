import { Link } from "react-router-dom";
import { Disc3, Film, Palette, Share2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Release & tracks",
    description: "Add your single, EP, or album — upload audio and set the release date.",
    to: "/create",
    cta: "Start promo setup",
    icon: Disc3,
  },
  {
    title: "Promo videos",
    description: "Turn hooks and artwork into 9:16 clips in the video studio or during campaign create.",
    to: "/studio",
    cta: "Open video studio",
    icon: Film,
  },
  {
    title: "Cover art",
    description: "Generate or design artwork with AI, then attach it to your release.",
    to: "/artwork",
    cta: "Cover lab",
    icon: Palette,
  },
  {
    title: "Publish",
    description: "Connect TikTok, Instagram, or YouTube and auto-schedule plan days.",
    to: "/social/connect",
    cta: "Connect social",
    icon: Share2,
  },
];

export default function PromoPathCards({ className }) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-3xl border border-border/50 bg-gradient-to-br from-primary/[0.07] via-card/80 to-card/60 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4",
        className
      )}
    >
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        return (
          <Link
            key={step.title}
            to={step.to}
            className="group flex flex-col rounded-2xl border border-border/40 bg-background/70 p-4 transition hover:border-primary/35 hover:bg-background hover:shadow-[var(--shadow-soft)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground">
                Step {index + 1}
              </span>
            </div>
            <h3 className="font-heading text-sm font-semibold text-foreground">{step.title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-600 text-primary">
              {step.cta}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
