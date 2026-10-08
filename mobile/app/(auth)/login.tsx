import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Link, Redirect, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthLayout } from "@/components/AuthLayout";
import { GoogleIcon } from "@/components/GoogleIcon";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthContext";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

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
    <AuthLayout
      icon="log-in-outline"
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <Text muted style={{ textAlign: "center" }}>
          Don’t have an account?{" "}
          <Link href="/(auth)/register" asChild>
            <Text color={colors.primary} variant="bodyStrong">
              Create one
            </Text>
          </Link>
        </Text>
      }
    >
      <Button
        title="Continue with Google"
        variant="outline"
        size="lg"
        onPress={onGoogle}
        loading={googleLoading}
        disabled={loading || googleLoading}
        leftIcon={<GoogleIcon size={20} />}
        accessibilityHint="Sign in with your Google account"
      />

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text muted variant="caption" style={styles.or}>
          OR
        </Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      {error ? (
        <View
          style={[styles.errorBox, { backgroundColor: colors.destructive + "1A" }]}
          accessibilityRole="alert"
        >
          <Text color={colors.destructive} variant="label">
            {error}
          </Text>
        </View>
      ) : null}

      <Input
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        autoFocus
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        leftIcon={<Ionicons name="mail-outline" size={16} color={colors.mutedForeground} />}
      />

      <Input
        label="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        leftIcon={<Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} />}
        labelRight={
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <Text color={colors.primary} variant="caption">
                Forgot password?
              </Text>
            </Pressable>
          </Link>
        }
      />

      <Button
        title={loading ? "Logging in..." : "Log in"}
        size="lg"
        onPress={submit}
        loading={loading}
        disabled={loading || googleLoading}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { letterSpacing: 0.6, textTransform: "uppercase" },
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
