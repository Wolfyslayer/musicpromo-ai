import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthLayout } from "@/components/AuthLayout";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { db } from "@/api/base44Client";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme";
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
    <AuthLayout
      icon="lock-closed-outline"
      title="Choose new password"
      subtitle="Complete the reset after opening the email deep link"
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
      <Input
        label="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        leftIcon={<Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} />}
      />
      <Button
        title="Update password"
        size="lg"
        onPress={submit}
        loading={loading}
        disabled={loading}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  errorBox: { borderRadius: radius.md, padding: spacing.md },
});
