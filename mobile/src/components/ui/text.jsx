import { Text as RNText } from "react-native";
import { cn } from "@/lib/utils";

/** React Native text doesn't inherit color from its parent View, so every Text gets the theme foreground. */
export function Text({ className, ...props }) {
  return <RNText className={cn("text-base text-foreground", className)} {...props} />;
}

export function Heading({ className, ...props }) {
  return <RNText className={cn("font-heading text-2xl tracking-tight text-foreground", className)} {...props} />;
}
