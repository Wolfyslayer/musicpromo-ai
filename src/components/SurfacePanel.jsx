import { cn } from "@/lib/utils";

/** Standard elevated content block (forms, settings sections, wizard steps). */
export default function SurfacePanel({ className, children, ...props }) {
  return (
    <div className={cn("surface rounded-2xl p-5 md:p-6", className)} {...props}>
      {children}
    </div>
  );
}
