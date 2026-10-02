import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { ActivityIndicator, Text, View } from "react-native";
import { completeAuthUrl } from "@/lib/auth";
import { errorMessage } from "@/lib/format";

export default function GoogleCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url) return;
    let active = true;
    completeAuthUrl(url)
      .then(() => {
        if (active) router.replace("/");
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, "Google sign-in failed"));
      });
    return () => {
      active = false;
    };
  }, [router, url]);

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-6">
      {error ? <Text className="text-center font-sans text-sm text-destructive">{error}</Text> : <ActivityIndicator color="#a164f7" />}
      <Text className="font-sans text-sm text-muted-foreground">Finishing sign-in…</Text>
    </View>
  );
}
