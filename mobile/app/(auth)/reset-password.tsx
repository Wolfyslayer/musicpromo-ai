import { useState } from "react";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { db } from "@/api/base44Client";
import { useAppTheme } from "@/theme/ThemeProvider";
import { userFacingError } from "@/lib/errors";

export default function ResetPasswordScreen() {
  const { colors } = useAppTheme();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await db.auth.resetPassword({ newPassword: password });
      router.replace("/(auth)/login");
    } catch (e) {
      setError(userFacingError(e, "Could not update password. Open the email link first."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text variant="display">Choose new password</Text>
      <Text muted>Complete the reset after opening the email deep link.</Text>
      {error ? (
        <Text color={colors.destructive} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Input label="New password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Update password" onPress={submit} loading={loading} disabled={loading} />
    </Screen>
  );
}
