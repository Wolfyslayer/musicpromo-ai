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

export default function RegisterScreen() {
  const { register, loginWithGoogle, isAuthenticated } = useAuth();
  const { colors } = useAppTheme();
  const { online } = useNetworkStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  const goHome = () => router.replace("/(app)/(tabs)");

  const submit = async () => {
    if (loading || googleLoading) return;
    setError("");
    setInfo("");
    if (!online) {
      setError("You’re offline. Reconnect to register.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, handle.trim() || undefined);
      setInfo("Check your email to confirm, or continue if confirmation is disabled.");
      goHome();
    } catch (e) {
      setError(userFacingError(e, "Could not create account."));
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
        <Text variant="caption" color={colors.primary}>
          MusicPromo AI
        </Text>
        <Text variant="display">Create account</Text>
        <Text muted>Same Supabase backend as the web studio.</Text>
      </View>

      {error ? (
        <Text color={colors.destructive} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {info ? <Text color={colors.success}>{info}</Text> : null}

      <Button
        title="Continue with Google"
        variant="outline"
        onPress={onGoogle}
        loading={googleLoading}
        disabled={loading || googleLoading}
      />

      <Input label="Handle (optional)" value={handle} onChangeText={setHandle} autoCapitalize="none" />
      <Input
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Input label="Password" secureTextEntry value={password} onChangeText={setPassword} />

      <Button title="Sign up" onPress={submit} loading={loading} disabled={loading || googleLoading} />

      <View style={styles.footer}>
        <Text muted>Already have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <Text color={colors.primary} variant="bodyStrong">
            Log in
          </Text>
        </Link>
      </View>

      <Button title="Continue browsing" variant="ghost" onPress={goHome} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, marginTop: spacing["2xl"] },
  footer: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.lg },
});
