import { cn } from "@/lib/utils";

/**
 * Sticky section header (title + nav) used by Settings, Social, and similar shells.
 */
export default function SectionChrome({ children, className, header, nav }) {
  return (
    <div className={cn("page-stack pb-1", className)}>
      <div className="section-chrome">
        {header}
        {nav}
      </div>
      {children}
    </div>
  );
}
