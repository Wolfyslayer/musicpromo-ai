import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { View } from "react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, ErrorText, Field, Muted } from "@/components/ui";
import { completeAuthUrl } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const router = useRouter();
  const url = Linking.useURL();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (url && (url.includes("code=") || url.includes("access_token"))) {
          await completeAuthUrl(url);
        }
        const session = supabase ? (await supabase.auth.getSession()).data.session : null;
        if (active) setReady(Boolean(session));
      } catch (err) {
        if (active) setError(errorMessage(err));
      }
    })();
    return () => {
      active = false;
    };
  }, [url]);

  const save = async () => {
    setError("");
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await db.auth.resetPassword({ newPassword: password });
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err, "Could not update password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen title="Choose a new password" subtitle="This updates the account from your reset link">
      {ready ? (
        <View className="gap-4">
          <ErrorText>{error}</ErrorText>
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
          <Button label="Update password" onPress={save} loading={loading} />
        </View>
      ) : (
        <View className="gap-3">
          <ErrorText>{error}</ErrorText>
          <Muted>Open the reset link from your email on this device, then enter a new password.</Muted>
        </View>
      )}
    </AuthScreen>
  );
}
