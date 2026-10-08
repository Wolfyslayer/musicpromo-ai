import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Link, Redirect, router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/auth/AuthContext";
import { useAppTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { getGoogleClientId } from "@/lib/googleAuth";

export default function LoginScreen() {
  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const { colors } = useAppTheme();
  const { online } = useNetworkStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  const goHome = () => router.replace("/(app)/(tabs)");

  const submit = async () => {
    if (loading || googleLoading) return;
    setError("");
    if (!online) {
      setError("You’re offline. Reconnect to sign in.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      goHome();
    } catch (e) {
      setError(userFacingError(e, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (loading || googleLoading) return;
    setError("");
    if (!online) {
      setError("You’re offline. Reconnect to sign in.");
      return;
    }
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      goHome();
    } catch (e) {
      setError(userFacingError(e, "Google sign-in failed."));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen>
      <OfflineBanner />
      <View style={styles.hero}>
        <Text variant="caption" color={colors.primary} accessibilityRole="header">
          MusicPromo AI
        </Text>
        <Text variant="display">Welcome back</Text>
        <Text muted>Log in to save promos — or keep browsing as a guest.</Text>
      </View>

      {error ? (
        <Text color={colors.destructive} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Button
        title="Continue with Google"
        variant="outline"
        onPress={onGoogle}
        loading={googleLoading}
        disabled={loading || googleLoading}
        accessibilityHint="Sign in with your Google account"
      />
      {!getGoogleClientId() ? (
        <Text muted variant="caption">
          Uses Supabase Google OAuth. Add EXPO_PUBLIC_GOOGLE_CLIENT_ID for id_token sign-in, and
          allowlist musicpromoai://auth/callback in Supabase Auth redirect URLs.
        </Text>
      ) : null}

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text muted variant="caption">
          or
        </Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      <Input
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />
      <Input
        label="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
      />

      <Button title="Log in" onPress={submit} loading={loading} disabled={loading || googleLoading} />

      <Link href="/(auth)/forgot-password" asChild>
        <Text color={colors.primary} variant="label">
          Forgot password?
        </Text>
      </Link>

      <View style={styles.footer}>
        <Text muted>Don’t have an account? </Text>
        <Link href="/(auth)/register" asChild>
          <Text color={colors.primary} variant="bodyStrong">
            Create one
          </Text>
        </Link>
      </View>

      <Button title="Continue browsing" variant="ghost" onPress={goHome} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, marginTop: spacing["2xl"], marginBottom: spacing.md },
  footer: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.lg },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
