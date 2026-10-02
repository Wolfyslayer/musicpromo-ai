import { Link } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAware } from "@/components/KeyboardAware";

export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAware>
        <View className="flex-1 justify-center px-5 py-8">
          <Link href="/" className="mb-8 font-heading text-lg text-foreground">
            MusicPromo AI
          </Link>
          <Text className="font-heading text-3xl text-foreground">{title}</Text>
          <Text className="mb-6 mt-2 font-sans text-sm text-muted-foreground">{subtitle}</Text>
          <View className="rounded-3xl border border-border bg-card p-5">{children}</View>
          {footer ? <View className="mt-6 items-center">{footer}</View> : null}
        </View>
      </KeyboardAware>
    </SafeAreaView>
  );
}
