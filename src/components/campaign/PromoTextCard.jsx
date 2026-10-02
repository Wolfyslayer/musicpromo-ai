import CopyButton from "@/components/CopyButton";

/**
 * Compact labeled text card for captions, hooks, hashtags, CTAs, etc.
 */
export default function PromoTextCard({ label, text, className = "" }) {
  if (!text) return null;
  return (
    <div className={`rounded-xl border border-border/50 bg-muted/30 p-3 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <CopyButton text={text} label="Copy" />
      </div>
      <p className={`text-sm break-words whitespace-pre-wrap ${label === "HASHTAGS" ? "font-mono text-xs text-primary" : ""}`}>
        {text}
      </p>
    </div>
  );
}
