import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

export default function AuthLayout({ icon, title, subtitle, footer, children }) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow justify-center px-4 py-8">
          <View className="w-full max-w-md self-center">
            <View className="mb-8 items-center">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                <Icon as={icon} size={28} className="text-primary-foreground" />
              </View>
              <Text className="text-center text-3xl font-700 tracking-tight">{title}</Text>
              {subtitle ? <Text className="mt-2 text-center text-muted-foreground">{subtitle}</Text> : null}
            </View>
            <View className="gap-4 rounded-2xl border border-border bg-card p-6">{children}</View>
            {footer ? <View className="mt-6 flex-row flex-wrap justify-center">{footer}</View> : null}
            <View className="mt-4 flex-row justify-center gap-1">
              <Link href="/privacy" className="text-xs text-muted-foreground">
                Privacy
              </Link>
              <Text className="text-xs text-muted-foreground">·</Text>
              <Link href="/terms" className="text-xs text-muted-foreground">
                Terms
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Input with a leading icon, as on the web auth forms. */
export function IconInput({ icon, className, ...props }) {
  const colors = useThemeColors();
  return (
    <View className="justify-center">
      <View className="absolute left-3 z-10">
        <Icon as={icon} size={16} color={colors.mutedForeground} className="text-muted-foreground" />
      </View>
      <Input className={cn("h-12 pl-10", className)} {...props} />
    </View>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <View className="rounded-lg bg-destructive/10 p-3">
      <Text className="text-sm text-destructive">{message}</Text>
    </View>
  );
}

export function OrDivider() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-border" />
      <Text className="text-xs uppercase text-muted-foreground">or</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
