import { Link } from "expo-router";
import { Text, View } from "react-native";
import { Screen } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/lib/legal";

type Section = { title: string; body?: string; bullets?: string[] };

export function LegalDocument({ title, sections }: { title: string; sections: Section[] }) {
  return (
    <Screen>
      <View className="mb-6 flex-row items-center justify-between">
        <Link href="/" className="font-heading text-lg text-foreground">
          MusicPromo AI
        </Link>
        <View className="flex-row gap-3">
          <Link href="/privacy" className="font-sans text-sm text-muted-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="font-sans text-sm text-muted-foreground">
            Terms
          </Link>
          <Link href="/login" className="font-sans text-sm text-muted-foreground">
            Sign in
          </Link>
        </View>
      </View>
      <Text className="font-heading text-3xl text-foreground">{title}</Text>
      <View className="mt-6 gap-4">
        {sections.map((section) => (
          <View key={section.title || section.body} className="gap-2">
            {section.title ? <Text className="font-heading text-base text-foreground">{section.title}</Text> : null}
            {section.body ? <Text className="font-sans text-sm leading-6 text-muted-foreground">{section.body}</Text> : null}
            {section.bullets?.map((bullet) => (
              <Text key={bullet} className="font-sans text-sm leading-6 text-muted-foreground">
                • {bullet}
              </Text>
            ))}
          </View>
        ))}
      </View>
      <Text className="mt-8 font-sans text-xs text-muted-foreground">
        Last updated: October 1, 2026 · {SUPPORT_EMAIL}
      </Text>
    </Screen>
  );
}
