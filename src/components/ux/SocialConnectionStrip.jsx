import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const ORDER = ["instagram", "tiktok", "youtube", "x"];

export default function SocialConnectionStrip({ providers = [], className }) {
  const byId = Object.fromEntries(providers.map((p) => [p.id, p]));

  return (
    <div
      data-tour="launch-connections"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-muted/15 px-3 py-2",
        className
      )}
    >
      <span className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground">Connections</span>
      {ORDER.map((id) => {
        const p = byId[id];
        const connected = p?.status === "connected";
        const warn = connected && (p?.needsPublishReauth || p?.canPublish === false);
        return (
          <Link
            key={id}
            to={`/social/connect?focus=${id}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-500 transition hover:border-primary/40",
              connected && !warn
                ? "border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                : warn
                  ? "border-amber-500/40 text-amber-800 dark:text-amber-200"
                  : "border-border/60 text-muted-foreground"
            )}
          >
            {connected && !warn ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Circle className="h-3 w-3" />
            )}
            {p?.label || id}
          </Link>
        );
      })}
    </div>
  );
}
