import { cssInterop } from "nativewind";
import { cn } from "@/lib/utils";

const registered = new WeakSet();

/**
 * Renders a lucide-react-native icon and lets `className` text colors (text-primary, text-muted-foreground…)
 * drive the SVG stroke color. Size is a number prop because SVG icons don't read h-/w- classes.
 */
export function Icon({ as: Component, className, size = 16, strokeWidth = 2, ...props }) {
  if (!Component) return null;
  if (!registered.has(Component)) {
    cssInterop(Component, {
      className: { target: "style", nativeStyleToProp: { color: true, opacity: true } },
    });
    registered.add(Component);
  }
  return <Component className={cn("text-foreground", className)} size={size} strokeWidth={strokeWidth} {...props} />;
}
