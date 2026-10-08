import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { useAppTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { colors } = useAppTheme();

  return (
    <Screen>
      <OfflineBanner />
      <Text variant="heading">Settings</Text>
      <Card>
        <Text variant="label" muted>
          Account
        </Text>
        <Text variant="bodyStrong">{user?.email || "Signed in"}</Text>
        <Text muted variant="caption">
          {user?.full_name || "No display name"} · role {user?.role || "artist"}
        </Text>
      </Card>

      <Card>
        <Text variant="label" muted>
          Backend
        </Text>
        <Text>
          Supabase {isSupabaseConfigured ? "configured" : "missing EXPO_PUBLIC env"}
        </Text>
        <Text muted variant="caption">
          Billing, team, and studio preferences deep UI remain on web. Session uses AsyncStorage +
          SecureStore token mirror.
        </Text>
      </Card>

      <Card>
        <Text variant="label" muted>
          More on web
        </Text>
        <Text muted variant="caption">
          Social OAuth, community, artwork AI lab, Remotion export, Stripe checkout — available in
          the Vite app until ported. Features are not removed from the product.
        </Text>
        <Button title="Open video studio" variant="secondary" onPress={() => router.push("/(app)/video")} />
      </Card>

      <Button
        title="Log out"
        variant="destructive"
        onPress={async () => {
          await logout();
          router.replace("/(auth)/login");
        }}
      />
      <View style={styles.footer}>
        <Text muted variant="caption" color={colors.mutedForeground}>
          MusicPromo AI · Expo native client
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: spacing.xl, alignItems: "center" },
});
