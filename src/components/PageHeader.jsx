import { cn } from "@/lib/utils";

/**
 * Large-title page header (iOS-style hierarchy).
 */
export default function PageHeader({ eyebrow, title, description, actions, className, titleClassName }) {
  return (
    <header className={cn("animate-fade-in", className)}>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p>
      ) : null}
      <h1
        className={cn(
          "font-heading text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground md:text-[2rem]",
          eyebrow ? "mt-1" : "",
          titleClassName
        )}
      >
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {actions ? <div className="mt-5 flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}
