import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default function YouTubeCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string | string[];
    state?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const linkedUrl = Linking.useURL();
  const [error, setError] = useState("");

  useEffect(() => {
    const fromLink = linkedUrl ? Linking.parse(linkedUrl) : null;
    const query = fromLink?.queryParams || {};
    let searchCode = "";
    let searchState = "";
    let searchError = "";
    if (typeof window !== "undefined" && window.location?.href) {
      const current = new URL(window.location.href);
      searchCode = current.searchParams.get("code") || "";
      searchState = current.searchParams.get("state") || "";
      searchError = current.searchParams.get("error_description") || current.searchParams.get("error") || "";
    }
    const oauthError = first(params.error_description) || first(params.error) || searchError || String(query.error_description || query.error || "");
    const code = first(params.code) || searchCode || String(query.code || "");
    const state = first(params.state) || searchState || String(query.state || "");
    if (!oauthError && !code && !state && !linkedUrl && typeof window === "undefined") return;
    let active = true;
    (async () => {
      try {
        if (oauthError) throw new Error(decodeURIComponent(oauthError.replace(/\+/g, " ")));
        if (!code || !state) throw new Error("Missing authorization data from Google.");
        const result = await db.functions.invoke("youtubeOAuthComplete", { code, state });
        if (!result.data?.ok) throw new Error(result.data?.error || "Could not finish YouTube connection.");
        if (active) router.replace({ pathname: "/social", params: { social_connected: "youtube" } });
      } catch (err) {
        if (active) setError(errorMessage(err, "YouTube connection failed."));
      }
    })();
    return () => {
      active = false;
    };
  }, [linkedUrl, params.code, params.error, params.error_description, params.state, router]);

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-6">
      {error ? (
        <>
          <Text className="text-center font-sans text-sm text-destructive">{error}</Text>
          <Pressable onPress={() => router.replace("/social")}>
            <Text className="font-sans text-sm text-primary">Back to Social Hub</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color="#a164f7" />
          <Text className="font-sans text-sm text-muted-foreground">Finishing YouTube connection…</Text>
        </>
      )}
    </View>
  );
}
