import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OfflineBanner } from "@/components/OfflineBanner";
import { GuestBanner } from "@/components/GuestBanner";
import { useAuth } from "@/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { getAuthRedirectUri, getGoogleClientId } from "@/lib/googleAuth";
import { useAppTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme";

export default function SettingsScreen() {
  const { user, logout, isAuthenticated } = useAuth();
  const { colors } = useAppTheme();

  return (
    <Screen>
      <OfflineBanner />
      <GuestBanner />
      <Text variant="heading">Settings</Text>
      <Card>
        <Text variant="label" muted>
          Account
        </Text>
        {isAuthenticated ? (
          <>
            <Text variant="bodyStrong">{user?.email || "Signed in"}</Text>
            <Text muted variant="caption">
              {user?.full_name || "No display name"} · role {user?.role || "artist"}
            </Text>
          </>
        ) : (
          <>
            <Text variant="bodyStrong">Guest</Text>
            <Text muted variant="caption">
              Sign in with email/password or Google to sync your studio data.
            </Text>
            <Button title="Sign in" onPress={() => router.push("/(auth)/login")} />
            <Button
              title="Create account"
              variant="outline"
              onPress={() => router.push("/(auth)/register")}
            />
          </>
        )}
      </Card>

      <Card>
        <Text variant="label" muted>
          Backend
        </Text>
        <Text>
          Supabase {isSupabaseConfigured ? "configured" : "missing EXPO_PUBLIC env"}
        </Text>
        <Text muted variant="caption">
          Google client ID {getGoogleClientId() ? "set" : "not set (Supabase OAuth fallback)"}.
          Redirect URI for OAuth allowlist: {getAuthRedirectUri()}
        </Text>
      </Card>

      <Card>
        <Text variant="label" muted>
          More on web
        </Text>
        <Text muted variant="caption">
          Social OAuth connect, community, artwork AI lab, Remotion export, Stripe checkout —
          available in the Vite app until ported.
        </Text>
        <Button title="Open video studio" variant="secondary" onPress={() => router.push("/(app)/video")} />
      </Card>

      {isAuthenticated ? (
        <Button
          title="Log out"
          variant="destructive"
          onPress={async () => {
            await logout();
            router.replace("/(app)/(tabs)");
          }}
        />
      ) : null}
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
