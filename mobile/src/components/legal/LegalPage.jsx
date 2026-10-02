import { Children } from "react";
import { Linking, View } from "react-native";
import { Link, router } from "expo-router";
import { cn } from "@/lib/utils";
import { Screen } from "@/components/Screen";
import { Heading, Text } from "@/components/ui/text";
import { Separator } from "@/components/ui/controls";

export const SUPPORT_EMAIL = "support@flying-sonic-promo-flow.base44.app";

/**
 * Shared chrome for public legal pages (no login required — needed for TikTok / Google app review).
 */
export default function LegalPage({ title, children }) {
  return (
    <Screen contentClassName="gap-6 pb-16">
      <View className="flex-row items-center justify-between gap-3">
        <Link href="/" className="font-heading text-lg tracking-tight text-foreground">
          MusicPromo AI
        </Link>
        <View className="flex-row gap-3">
          <Link href="/privacy" replace className="text-sm text-muted-foreground">
            Privacy
          </Link>
          <Link href="/terms" replace className="text-sm text-muted-foreground">
            Terms
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground">
            Sign in
          </Link>
        </View>
      </View>
      <Separator />
      <Heading className="text-3xl">{title}</Heading>
      <View className="gap-4">{children}</View>
      <Text className="pt-6 text-xs text-muted-foreground">
        Last updated: October 1, 2026 ·{" "}
        <Text className="text-xs text-muted-foreground underline" onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}`)}>
          Contact support
        </Text>
      </Text>
    </Screen>
  );
}

function openUrl(url) {
  Linking.openURL(url).catch(() => {});
}

export function P({ children, className }) {
  return <Text className={cn("text-sm leading-relaxed text-muted-foreground", className)}>{children}</Text>;
}

export function H2({ children }) {
  return <Text className="mt-4 font-heading text-base text-foreground">{children}</Text>;
}

export function Strong({ children }) {
  return <Text className="text-sm font-600 text-foreground">{children}</Text>;
}

export function UL({ children }) {
  return (
    <View className="gap-1 pl-1">
      {Children.map(children, (child) =>
        child ? (
          <View className="flex-row gap-2">
            <Text className="text-sm leading-relaxed text-muted-foreground">•</Text>
            <View className="flex-1">{child}</View>
          </View>
        ) : null
      )}
    </View>
  );
}

export function LI({ children }) {
  return <P>{children}</P>;
}

/** Inline link for use inside <P>. `href` may be mailto:/https: (opened externally) or an in-app path. */
export function A({ href, children }) {
  const onPress = () => {
    if (/^(mailto:|https?:)/i.test(href)) openUrl(href);
    else router.push(href);
  };
  return (
    <Text className="text-sm text-muted-foreground underline" onPress={onPress} suppressHighlighting>
      {children}
    </Text>
  );
}
