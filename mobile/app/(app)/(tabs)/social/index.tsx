import { useCallback, useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Badge, Button, Card, Empty, ErrorText, Muted, P, Screen } from "@/components/ui";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";
import { mergeProviders, selectSocialWorkspace, startOAuth } from "@/lib/social";
import type { Row } from "@/lib/types";

export default function SocialHub() {
  const router = useRouter();
  const params = useLocalSearchParams<{ social_connected?: string; social_error?: string }>();
  const { toast } = useToast();
  const { isAuthenticated, requireAuth, refreshKey } = useAuth();
  const [providers, setProviders] = useState<ReturnType<typeof mergeProviders>>([]);
  const [posts, setPosts] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const reload = useCallback(() => {
    selectSocialWorkspace()
      .then((workspace) => {
        setProviders(mergeProviders(workspace.connections));
        setPosts(workspace.posts);
        setError("");
      })
      .catch((err) => {
        setProviders(mergeProviders([]));
        setError(isAuthenticated ? errorMessage(err) : "");
      });
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    if (params.social_connected) toast({ title: `${params.social_connected} connected` });
    if (params.social_error) toast({ title: "Connection failed", description: String(params.social_error), variant: "destructive" });
  }, [params.social_connected, params.social_error, toast]);

  const connect = async (id: string) => {
    if (!requireAuth()) return;
    setBusy(id);
    try {
      const result = await startOAuth(id);
      const url = result.data?.authorizationUrl || result.data?.url;
      if (!url) throw new Error(result.data?.error || "No authorization URL returned.");
      await WebBrowser.openBrowserAsync(url);
      toast({ title: "Finish connecting in the browser", description: "Return here and pull to refresh after approval." });
    } catch (err) {
      toast({ title: "Connect failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const disconnect = async (id: string) => {
    setBusy(id);
    try {
      await db.entities.SocialAccount.delete(id);
      toast({ title: "Disconnected" });
      reload();
    } catch (err) {
      toast({ title: "Could not disconnect", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  return (
    <Screen>
      <View className="gap-4">
        <Muted>Connect Instagram, TikTok, or YouTube, then compose a post from a campaign day.</Muted>
        <ErrorText>{error}</ErrorText>
        {providers.map((provider) => (
          <Card key={provider.id} className="gap-2">
            <View className="flex-row items-center justify-between">
              <P className="font-semibold">{provider.name}</P>
              <Badge status={provider.connected ? "connected" : "draft"} />
            </View>
            <Muted>{provider.connection?.username || provider.connection?.accountName || provider.description}</Muted>
            {provider.oauth ? (
              provider.connected && provider.connection?.id ? (
                <Button label="Disconnect" variant="outline" loading={busy === provider.id} onPress={() => disconnect(provider.connection.id)} />
              ) : (
                <Button label="Connect" loading={busy === provider.id} onPress={() => connect(provider.id)} />
              )
            ) : (
              <Muted>Not available on mobile yet.</Muted>
            )}
          </Card>
        ))}
        <Button label="Compose post" onPress={() => router.push("/social/compose")} />
        <P className="font-semibold">Drafts and posts</P>
        {posts.length ? (
          posts.slice(0, 20).map((post) => (
            <Card key={post.id} className="gap-1">
              <Badge status={post.status} />
              <P>{post.caption || post.hook || "Untitled post"}</P>
              <Muted>{post.platform || post.provider || "Social"}</Muted>
            </Card>
          ))
        ) : (
          <Empty title="No posts yet" description="Compose from a campaign day when you are ready to publish." />
        )}
      </View>
    </Screen>
  );
}
