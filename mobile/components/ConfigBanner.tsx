import { Text, View } from "react-native";
import { isSupabaseConfigured } from "@/lib/supabase";

export function ConfigBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <View className="rounded-2xl border border-border bg-card p-3">
      <Text className="font-sans text-sm text-foreground">Supabase is not configured in this build.</Text>
      <Text className="mt-1 font-sans text-xs text-muted-foreground">
        Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env, then restart Expo.
      </Text>
    </View>
  );
}
