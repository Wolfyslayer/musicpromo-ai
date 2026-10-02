import { useCallback, useEffect, useRef, useState } from "react";
import { Linking as RNLinking, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, ExternalLink, Plus, Send, Share2, Sparkles } from "lucide-react-native";
import { startOAuth, mergeProvidersWithConnections, buildComposePath, POST_STATUS } from "@/services/socialService";
import { deleteSocialAccount, selectSocialWorkspace } from "@/services/studioRecords";
import { OAUTH_REDIRECTS } from "@/lib/oauthRedirects";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import SocialPlatformCard from "@/components/social/SocialPlatformCard";

const ERROR_MESSAGES = {
  cancelled: "Authorization was cancelled.",
  invalid_response: "The authorization response was incomplete.",
  invalid_state: "This connection request was invalid or expired. Please try again.",
  state_reused: "This connection link was already used. Please try again.",
  expired_state: "This connection request expired. Please try again.",
  not_configured: "This platform is not configured on the server yet.",
  provider_error: "Connection failed. Check app credentials and the OAuth redirect URI in the developer console.",
  client_init_failed: "Server could not start the OAuth callback. Try again in a moment.",
  state_lookup_failed: "Could not validate the login session. Try Connect again.",
  state_consume_failed: "Could not finish the login session. Try Connect again.",
  token_exchange_failed:
    "The provider rejected the login code. Confirm client ID/secret and that the redirect URI matches exactly.",
  bad_credentials: "The provider rejected the app credentials. Check the secrets configured in Base44.",
  redirect_mismatch: `OAuth redirect URI mismatch. Register ${OAUTH_REDIRECTS.instagram} in Meta, ${OAUTH_REDIRECTS.tiktok} in TikTok, and ${OAUTH_REDIRECTS.youtube} in Google.`,
  profile_failed: "Login succeeded but no account profile was returned. Check account type and try Connect again.",
  encrypt_failed: "Could not store credentials. SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes as base64.",
  account_save_failed: "Login worked, but saving the connection failed. Try Connect again.",
};

const OAUTH_PARAM_KEYS = [
  "social_error",
  "error",
  "details",
  "meta",
  "social_connected",
  "social_warning",
  "social_debug_type",
  "social_debug_step",
  "social_debug_message",
  "social_debug_stack",
  "social_debug_meta",
  "provider",
];

const CONNECTABLE = new Set(["instagram", "tiktok", "youtube"]);
const EMPTY_WORKSPACE = { connections: [], posts: [] };

const first = (v) => (Array.isArray(v) ? v[0] : v) || "";

const providerLabel = (id) =>
  id === "tiktok" ? "TikTok" : id === "youtube" ? "YouTube" : id === "instagram" ? "Instagram" : id || "Account";

function readOAuthParams(source = {}) {
  const get = (k) => first(source[k]);
  return {
    err: get("social_error") || get("error"),
    ok: get("social_connected"),
    warn: get("social_warning"),
    details: get("details") || get("social_debug_message"),
    meta: get("meta") || get("social_debug_meta"),
    debugType: get("social_debug_type"),
    debugStep: get("social_debug_step"),
    debugStack: get("social_debug_stack"),
  };
}

const oauthSignature = (p) => (p.err || p.ok || p.warn || p.details || p.debugType ? JSON.stringify(p) : "");

/** Shows the same toasts as the web page for OAuth results returned on the deep link. Returns true if handled. */
function reportOAuthResult(p) {
  const { err, ok, warn, details, meta, debugType, debugStep, debugStack } = p;
  if (!err && !ok && !warn && !details && !debugType) return false;

  if (err || details || meta || debugType) {
    const debugPayload = {
      success: false,
      errorType: debugType || err || "provider_error",
      step: debugStep || null,
      message: details || ERROR_MESSAGES[err] || err || null,
      meta: meta || null,
      stack: debugStack || null,
      social_error: err || null,
    };
    console.error("--- SOCIAL OAUTH DEBUG ERROR ---");
    console.error("Full Error Object:", JSON.stringify(debugPayload, null, 2));
  }

  if (warn === "missing_publish_scope") {
    toast({
      variant: "destructive",
      title: "Connected without publishing",
      description:
        "The provider only granted limited access. Reconnect and approve all publish permissions on the consent screen.",
    });
  } else if (ok) {
    toast({ title: `${providerLabel(ok)} connected`, description: "Your account is linked to MusicPromo AI." });
  } else if (err) {
    toast({
      variant: "destructive",
      title: `Connection failed (${err})`,
      description: details || ERROR_MESSAGES[err] || `Authorization error code: ${err}`,
    });
  }
  return true;
}

/**
 * Social Hub — connect Instagram / TikTok / YouTube and manage publish drafts.
 */
export default function SocialHub() {
  const params = useLocalSearchParams();
  const { user, requireAuth, isAuthenticated } = useAuth();
  const [connectingId, setConnectingId] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);
  const handledRef = useRef("");

  const query = useQuery({
    queryKey: ["social-workspace", user?.id],
    queryFn: async () => {
      try {
        return await selectSocialWorkspace();
      } catch (e) {
        if (isAuthenticated) {
          toast({
            variant: "destructive",
            title: "Could not load social connections",
            description: e?.message || "Connect may still work — try again if a platform fails.",
          });
        }
        return EMPTY_WORKSPACE;
      }
    },
  });
  const { refetch } = query;
  const reload = useCallback(() => refetch(), [refetch]);
  useWorkspaceRefresh(reload);

  const loading = query.isLoading;
  const workspace = query.data || EMPTY_WORKSPACE;
  const providers = mergeProvidersWithConnections(workspace.connections, {});
  const posts = workspace.posts || [];

  const oauthParams = readOAuthParams(params);
  const paramSignature = oauthSignature(oauthParams);

  useEffect(() => {
    if (!paramSignature || handledRef.current === paramSignature) return;
    handledRef.current = paramSignature;
    reportOAuthResult(JSON.parse(paramSignature));
    refetch();
    router.setParams(Object.fromEntries(OAUTH_PARAM_KEYS.map((k) => [k, undefined])));
  }, [paramSignature, refetch]);

  const beginConnect = async (providerIdOrObj) => {
    const providerId = String(typeof providerIdOrObj === "string" ? providerIdOrObj : providerIdOrObj?.id || "")
      .trim()
      .toLowerCase();
    const provider =
      providers.find((p) => p.id === providerId) || (typeof providerIdOrObj === "object" ? providerIdOrObj : null);
    if (!CONNECTABLE.has(providerId)) return;
    setConnectingId(providerId);
    try {
      const forceReauth = provider?.needsPublishReauth === true || provider?.status === "connected";
      const res = await startOAuth(providerId, { forceReauth });
      if (res?.authorizationUrl) {
        const result = await WebBrowser.openAuthSessionAsync(res.authorizationUrl, Linking.createURL("/social"));
        const returned = result?.type === "success" && result.url ? readOAuthParams(Linking.parse(result.url).queryParams || {}) : null;
        const signature = returned ? oauthSignature(returned) : "";
        if (signature) {
          handledRef.current = signature;
          reportOAuthResult(returned);
        }
        const { data } = await refetch();
        if (!signature) {
          const live = (data?.connections || []).find((c) => c.provider === providerId && c.status === "connected");
          if (live) {
            toast({ title: `${providerLabel(providerId)} connected`, description: "Your account is linked to MusicPromo AI." });
          }
        }
        return;
      }
      console.error("[SocialHub] connectSocialProvider failed", JSON.stringify(res));
      const detailParts = [
        res?.error || res?.message || "OAuth start failed.",
        res?.provider ? `Got: ${res.provider}.` : null,
        Array.isArray(res?.supported) ? `Supported: ${res.supported.join(", ")}.` : null,
        res?.bodyKeys ? `Body keys: ${res.bodyKeys.join(", ")}.` : null,
      ].filter(Boolean);
      toast({
        variant: "destructive",
        title:
          res?.code === "not_configured"
            ? `${provider?.name || providerId} not configured`
            : `Could not start ${provider?.name || providerId} connection`,
        description: detailParts.join(" "),
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: `Could not start ${provider?.name || providerId} connection`,
        description: e?.message || "Please try again.",
      });
    } finally {
      setConnectingId(null);
    }
  };

  const onConnect = (providerIdOrObj) => {
    requireAuth(() => beginConnect(providerIdOrObj));
  };

  const onDisconnect = async (provider) => {
    if (!CONNECTABLE.has(provider.id)) return;
    setDisconnectingId(provider.id);
    try {
      if (provider.connection?.id) await deleteSocialAccount(provider.connection.id);
      toast({ title: "Disconnected", description: `${provider.name} has been disconnected.` });
      await refetch();
    } catch (e) {
      toast({ variant: "destructive", title: "Disconnect failed", description: e?.message || "Please try again." });
    } finally {
      setDisconnectingId(null);
    }
  };

  const ig = providers.find((p) => p.id === "instagram");
  const anyConnected = providers.some((p) => p.status === "connected");
  const drafts = posts.filter(
    (p) => p.status === POST_STATUS.DRAFT || p.status === POST_STATUS.SCHEDULED || p.status === POST_STATUS.PUBLISHING
  );
  const recent = posts.filter((p) => p.status === POST_STATUS.PUBLISHED || p.status === POST_STATUS.FAILED);

  return (
    <Screen refreshing={query.isRefetching} onRefresh={reload} contentClassName="gap-6">
      <View>
        <View className="flex-row items-center gap-2">
          <Icon as={Share2} size={16} className="text-primary" />
          <Text className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Social</Text>
        </View>
        <Text className="mt-1 font-heading text-2xl tracking-tight">Social Hub</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Connect Instagram, TikTok, and YouTube, then publish or auto-schedule campaign posts.
        </Text>
      </View>

      <View className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <Text className="text-sm text-muted-foreground">
          Connect at least one platform below. Schedule from Campaign Plan, or publish now from Compose.
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Button
            size="sm"
            icon={Plus}
            className="rounded-full"
            disabled={!anyConnected}
            onPress={() => router.push(buildComposePath())}
          >
            Create Social Post
          </Button>
          <Button size="sm" variant="outline" icon={Sparkles} className="rounded-full" onPress={() => router.push("/campaigns")}>
            View Campaign Content
          </Button>
          <Button size="sm" variant="outline" icon={CalendarDays} className="rounded-full" onPress={() => router.push("/releases")}>
            Releases & Calendar
          </Button>
        </View>
        {ig?.status === "connected" && ig?.needsPublishReauth ? (
          <Text className="mt-3 text-sm text-amber-600">
            Instagram granted: <Text className="font-mono text-xs text-amber-600">{ig.connection?.scopes || "none"}</Text>.
            Publishing needs <Text className="font-mono text-xs text-amber-600">instagram_business_content_publish</Text>.
            Reconnect and approve Instagram publish permission.
          </Text>
        ) : null}
      </View>

      <View className="gap-3">
        <Text className="font-heading text-sm uppercase tracking-wider text-muted-foreground">Connected Accounts</Text>
        {loading ? (
          <View className="h-40 rounded-2xl bg-muted/40" />
        ) : (
          <View className="gap-3">
            {providers.map((provider) => (
              <SocialPlatformCard
                key={provider.id}
                provider={provider}
                onConnect={CONNECTABLE.has(provider.id) ? onConnect : undefined}
                onDisconnect={CONNECTABLE.has(provider.id) ? onDisconnect : undefined}
                connecting={connectingId === provider.id}
                disconnecting={disconnectingId === provider.id}
              />
            ))}
          </View>
        )}
      </View>

      <View className="rounded-2xl border border-border/60 bg-card p-5">
        <View className="mb-3 flex-row items-center gap-2">
          <Icon as={Clock} size={16} className="text-primary" />
          <Text className="font-heading text-sm uppercase tracking-wider text-muted-foreground">Drafts & scheduled</Text>
        </View>
        {loading ? (
          <View className="h-24 rounded-xl bg-muted/40" />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No drafts yet"
            description="Create a social post from a campaign day or schedule auto-publish in the campaign plan."
            action={
              <Button className="rounded-full" disabled={!anyConnected} onPress={() => router.push(buildComposePath())}>
                Create Social Post
              </Button>
            }
            className="border-0 bg-transparent p-2"
          />
        ) : (
          <View className="gap-2">
            {drafts.map((p) => (
              <PostRow key={p.id} post={p} subtitle={`${p.mediaType || "IMAGE"} · ${p.provider || "instagram"}`} />
            ))}
          </View>
        )}
      </View>

      <View className="rounded-2xl border border-border/60 bg-card p-5">
        <View className="mb-3 flex-row items-center gap-2">
          <Icon as={Share2} size={16} className="text-primary" />
          <Text className="font-heading text-sm uppercase tracking-wider text-muted-foreground">Recent posts</Text>
        </View>
        {loading ? (
          <View className="h-24 rounded-xl bg-muted/40" />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No published posts yet"
            description="Successful and failed publish attempts will appear here."
            className="border-0 bg-transparent p-2"
          />
        ) : (
          <View className="gap-2">
            {recent.map((p) => (
              <PostRow key={p.id} post={p} subtitle={p.provider || "instagram"} showResult />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function PostRow({ post: p, subtitle, showResult = false }) {
  return (
    <View className="gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
      <View className="min-w-0 gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <StatusBadge status={p.status} />
          <Text className="flex-1 text-sm font-600" numberOfLines={1}>
            {(p.caption || "Untitled").slice(0, 60)}
          </Text>
        </View>
        <Text className="text-xs capitalize text-muted-foreground">{subtitle}</Text>
        {showResult && p.status === "failed" ? (
          <Text className="text-xs text-destructive">{p.errorMessage || "Publishing failed"}</Text>
        ) : null}
        {showResult && p.status === "published" && p.externalPostId ? (
          <Text className="text-xs text-muted-foreground">ID: {p.externalPostId}</Text>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {showResult && p.externalPermalink ? (
          <Button
            size="sm"
            variant="outline"
            icon={ExternalLink}
            className="rounded-full"
            onPress={() => WebBrowser.openBrowserAsync(p.externalPermalink).catch(() => RNLinking.openURL(p.externalPermalink))}
          >
            View
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="rounded-full" onPress={() => router.push(`/social/compose?post=${p.id}`)}>
          Open
        </Button>
      </View>
    </View>
  );
}
