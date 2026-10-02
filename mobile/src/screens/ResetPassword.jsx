import { useState } from "react";
import { View } from "react-native";
import { Link, router } from "expo-router";
import { AlertTriangle, Lock } from "lucide-react-native";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import AuthLayout, { FormError, IconInput } from "@/components/AuthLayout";

export default function ResetPassword() {
  const { isAuthenticated, setRecoveryMode } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await db.auth.resetPassword({ newPassword });
      setRecoveryMode(false);
      toast({ title: "Password updated", description: "You can now use your new password." });
      router.replace("/");
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Invalid reset link"
        subtitle="This password reset link is missing or invalid"
        footer={
          <Link href="/forgot-password" replace className="text-sm font-500 text-primary">
            Request a new link
          </Link>
        }
      >
        <Text className="text-center text-sm">
          Open the password reset link from your email on this device to set a new password. If the link has
          expired, request a new password reset email.
        </Text>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={Lock} title="New password" subtitle="Enter your new password below">
      <FormError message={error} />
      <View className="gap-2">
        <Label>New Password</Label>
        <IconInput
          icon={Lock}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus
          placeholder="••••••••"
          value={newPassword}
          onChangeText={setNewPassword}
        />
      </View>
      <View className="gap-2">
        <Label>Confirm Password</Label>
        <IconInput
          icon={Lock}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />
      </View>
      <Button className="h-12" onPress={handleSubmit} loading={loading} disabled={!newPassword || !confirmPassword}>
        {loading ? "Resetting..." : "Reset password"}
      </Button>
    </AuthLayout>
  );
}
