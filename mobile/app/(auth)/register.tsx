import { useState } from "react";
import { StyleSheet, View } from "react-native";
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
    <AuthLayout
      icon="person-add-outline"
      title="Create account"
      subtitle="Start promoting your releases"
      footer={
        <Text muted style={{ textAlign: "center" }}>
          Already have an account?{" "}
          <Link href="/(auth)/login" asChild>
            <Text color={colors.primary} variant="bodyStrong">
              Log in
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
      {info ? (
        <View style={[styles.errorBox, { backgroundColor: colors.success + "1A" }]}>
          <Text color={colors.success} variant="label">
            {info}
          </Text>
        </View>
      ) : null}

      <Input
        label="Handle (optional)"
        value={handle}
        onChangeText={setHandle}
        autoCapitalize="none"
        leftIcon={<Ionicons name="at-outline" size={16} color={colors.mutedForeground} />}
      />
      <Input
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        leftIcon={<Ionicons name="mail-outline" size={16} color={colors.mutedForeground} />}
      />
      <Input
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        leftIcon={<Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} />}
      />

      <Button
        title="Sign up"
        size="lg"
        onPress={submit}
        loading={loading}
        disabled={loading || googleLoading}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { letterSpacing: 0.6, textTransform: "uppercase" },
  errorBox: { borderRadius: radius.md, padding: spacing.md },
});
