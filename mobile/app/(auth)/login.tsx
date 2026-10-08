import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Link, router } from "expo-router";
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

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useAppTheme();
  const { online } = useNetworkStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft] = useState({ email: "", password: "" }); // preserve pattern for future

  const submit = async () => {
    if (loading) return;
    setError("");
    if (!online) {
      setError("You’re offline. Reconnect to sign in.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(app)/(tabs)");
    } catch (e) {
      setError(userFacingError(e, "Invalid email or password"));
      // keep form drafts
      draft.email = email;
      draft.password = password;
    } finally {
      setLoading(false);
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
        <Text muted>Log in to run release promos from your phone.</Text>
      </View>

      {error ? (
        <Text color={colors.destructive} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

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

      <Button title="Log in" onPress={submit} loading={loading} disabled={loading} />

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, marginTop: spacing["2xl"], marginBottom: spacing.md },
  footer: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.lg },
});
