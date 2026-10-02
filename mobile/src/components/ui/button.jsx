import { Children, isValidElement } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";
import { Icon } from "./icon";

const VARIANTS = {
  default: "bg-primary",
  destructive: "bg-destructive",
  outline: "border border-input bg-transparent",
  secondary: "bg-secondary",
  ghost: "bg-transparent",
  link: "bg-transparent px-0",
};

const TEXT_VARIANTS = {
  default: "text-primary-foreground",
  destructive: "text-destructive-foreground",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-foreground",
  link: "text-primary",
};

const SIZES = {
  default: "h-11 px-4",
  sm: "h-9 px-3",
  lg: "h-12 px-6",
  icon: "h-11 w-11 px-0",
};

const TEXT_SIZES = { default: "text-sm", sm: "text-xs", lg: "text-base", icon: "text-sm" };

/**
 * Pressable button with the web app's shadcn variants.
 * String children are wrapped in Text; `icon` takes a lucide component and is tinted to match the variant.
 */
export function Button({
  variant = "default",
  size = "default",
  className,
  textClassName,
  icon,
  iconRight,
  loading = false,
  disabled,
  children,
  ...props
}) {
  const textClass = cn("font-600", TEXT_SIZES[size], TEXT_VARIANTS[variant], textClassName);
  const isDisabled = disabled || loading;
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={cn(
        "flex-row items-center justify-center gap-2 rounded-xl active:opacity-80",
        VARIANTS[variant],
        SIZES[size],
        isDisabled && "opacity-50",
        className
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "default" || variant === "destructive" ? "#fff" : undefined} />
      ) : icon ? (
        <Icon as={icon} size={iconSize} className={textClass} />
      ) : null}
      {Children.map(children, (child) => {
        if (typeof child === "string" || typeof child === "number") {
          return (
            <Text className={textClass} numberOfLines={1}>
              {child}
            </Text>
          );
        }
        return isValidElement(child) ? child : null;
      })}
      {iconRight ? (
        <View>
          <Icon as={iconRight} size={iconSize} className={textClass} />
        </View>
      ) : null}
    </Pressable>
  );
}
