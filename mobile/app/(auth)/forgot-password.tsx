import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthLayout } from "@/components/AuthLayout";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthContext";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";

export default function ForgotPasswordScreen() {
  const { requestReset } = useAuth();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await requestReset(email.trim());
      setDone(true);
    } catch (e) {
      setError(userFacingError(e, "Could not send reset email."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon="key-outline"
      title="Reset password"
      subtitle="We’ll email a reset link for your account"
      footer={
        <Link href="/(auth)/login" asChild>
          <Text color={colors.primary} style={{ textAlign: "center" }}>
            Back to login
          </Text>
        </Link>
      }
    >
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
      {done ? (
        <View style={[styles.errorBox, { backgroundColor: colors.success + "1A" }]}>
          <Text color={colors.success} variant="label">
            Check your inbox for the reset link.
          </Text>
        </View>
      ) : (
        <>
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            leftIcon={<Ionicons name="mail-outline" size={16} color={colors.mutedForeground} />}
          />
          <Button
            title="Send reset link"
            size="lg"
            onPress={submit}
            loading={loading}
            disabled={loading}
          />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  errorBox: { borderRadius: radius.md, padding: spacing.md },
});
