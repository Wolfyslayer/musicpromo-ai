const TONE_CLASS = {
  featured: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  verified: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  early: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  campaign: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
};

export default function ProfileBadges({ badges, className = "" }) {
  if (!badges?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((b) => (
        <span
          key={b.id}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            TONE_CLASS[b.tone] || "bg-muted text-muted-foreground"
          }`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
