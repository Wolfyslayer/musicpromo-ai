import { cn } from "@/lib/utils";

export default function EyebrowLabel({ children, className, accent }) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.12em]",
        accent ? "text-primary" : "text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}
