import { useState } from "react";
import { Link } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthContext";
import { useAppTheme } from "@/theme/ThemeProvider";
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
    <Screen>
      <Text variant="display">Reset password</Text>
      <Text muted>We’ll email a reset link for your Supabase account.</Text>
      {error ? (
        <Text color={colors.destructive} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {done ? (
        <Text color={colors.success}>Check your inbox for the reset link.</Text>
      ) : (
        <>
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button title="Send reset link" onPress={submit} loading={loading} disabled={loading} />
        </>
      )}
      <Link href="/(auth)/login" asChild>
        <Text color={colors.primary}>Back to login</Text>
      </Link>
    </Screen>
  );
}
