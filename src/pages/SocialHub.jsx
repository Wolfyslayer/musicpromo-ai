import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Share2, CalendarDays, Sparkles, Send, Clock, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

import {
  getConnectionStatus,
  startOAuth,
  disconnectSocial,
  mergeProvidersWithConnections,
  loadPosts,
  buildComposePath,
  POST_STATUS,
} from "@/services/socialService";
import SocialPlatformCard from "@/components/social/SocialPlatformCard";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

const ERROR_MESSAGES = {
  cancelled: "Authorization was cancelled.",
  invalid_response: "The authorization response was incomplete.",
  invalid_state: "This connection request was invalid or expired. Please try again.",
  state_reused: "This connection link was already used. Please try again.",
  expired_state: "This connection request expired. Please try again.",
  not_configured: "This platform is not configured on the server yet.",
  provider_error:
    "Connection failed. Check app credentials and the OAuth redirect URI in the developer console.",
  client_init_failed: "Server could not start the OAuth callback. Try again in a moment.",
  state_lookup_failed: "Could not validate the login session. Try Connect again.",
  state_consume_failed: "Could not finish the login session. Try Connect again.",
  token_exchange_failed:
    "The provider rejected the login code. Confirm client ID/secret and that the redirect URI matches exactly.",
  bad_credentials:
    "The provider rejected the app credentials. Check the secrets configured in Base44.",
  redirect_mismatch:
    "OAuth redirect URI mismatch. Register https://flying-sonic-promo-flow.base44.app/functions/metaCustomCallback under Valid OAuth Redirect URIs.",
  profile_failed:
    "Login succeeded but no account profile was returned. Check account type and try Connect again.",
  encrypt_failed:
    "Could not store credentials. SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes as base64.",
  account_save_failed: "Login worked, but saving the connection failed. Try Connect again.",
};

const CONNECTABLE = new Set(["instagram", "tiktok", "youtube"]);

/**
 * Social Hub — connect Instagram / TikTok / YouTube and manage publish drafts.
 */
export default function SocialHub() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const { requireAuth, isAuthenticated } = useAuth();
  const [providers, setProviders] = useState(() => mergeProvidersWithConnections([], {}));
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [data, postData] = await Promise.all([
        getConnectionStatus(),
        loadPosts({}).catch(() => ({ posts: [] })),
      ]);
      const statusFailed = Boolean(data?.error) || data?.ok === false;
      // Keep Connect enabled for IG/TikTok/YouTube even if status fails —
      // do not fall back to static "unavailable / add secrets" gating.
      setProviders(
        mergeProvidersWithConnections(
          statusFailed ? [] : data?.connections || [],
          statusFailed ? {} : data?.providersConfigured || {}
        )
      );
      setPosts(postData?.posts || []);
      if (statusFailed && isAuthenticated) {
        toast({
          variant: "destructive",
          title: "Could not load social connections",
          description: data?.error || "Connect may still work — try again if a platform fails.",
        });
      }
    } catch (e) {
      // Keep oauth platforms connectable even when status request throws.
      setProviders(mergeProvidersWithConnections([], {}));
      if (isAuthenticated) {
        toast({
          variant: "destructive",
          title: "Could not load social connections",
          description: e?.message || "Connect may still work — try again if a platform fails.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast, isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);
  useWorkspaceRefresh(reload);

  useEffect(() => {
    const err = params.get("social_error") || params.get("error");
    const ok = params.get("social_connected");
    const warn = params.get("social_warning");
    const details = params.get("details") || params.get("social_debug_message");
    const meta = params.get("meta") || params.get("social_debug_meta");
    const debugType = params.get("social_debug_type");
    const debugStep = params.get("social_debug_step");
    const debugStack = params.get("social_debug_stack");
    if (!err && !ok && !warn && !details && !debugType) return;

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
      console.error("Error Message:", debugPayload.message);
      console.error("Step:", debugPayload.step);
      console.error("Error Type:", debugPayload.errorType);
      if (debugPayload.meta) console.error("Provider API data:", debugPayload.meta);
      if (debugPayload.stack) console.error("Stack:", debugPayload.stack);
      console.error("Full Error Object:", JSON.stringify(debugPayload, null, 2));
    }

    const connectedLabel =
      ok === "tiktok" ? "TikTok" : ok === "youtube" ? "YouTube" : ok === "instagram" ? "Instagram" : ok || "Account";

    if (warn === "missing_publish_scope") {
      toast({
        variant: "destructive",
        title: "Connected without publishing",
        description:
          "The provider only granted limited access. Reconnect and approve all publish permissions on the consent screen.",
      });
      reload();
    } else if (ok) {
      toast({
        title: `${connectedLabel} connected`,
        description: "Your account is linked to MusicPromo AI.",
      });
      reload();
    } else if (err) {
      toast({
        variant: "destructive",
        title: `Connection failed (${err})`,
        description: details || ERROR_MESSAGES[err] || `Authorization error code: ${err}`,
      });
    }

    const next = new URLSearchParams(params);
    [
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
    ].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  }, [params, setParams, toast, reload]);

  const beginConnect = async (providerIdOrObj) => {
    const providerId = String(
      typeof providerIdOrObj === "string" ? providerIdOrObj : providerIdOrObj?.id || ""
    )
      .trim()
      .toLowerCase();
    const provider =
      providers.find((p) => p.id === providerId) ||
      (typeof providerIdOrObj === "object" ? providerIdOrObj : null);
    if (!CONNECTABLE.has(providerId)) return;
    setConnectingId(providerId);
    try {
      const forceReauth =
        provider?.needsPublishReauth === true || provider?.status === "connected";
      console.info("[SocialHub] starting OAuth", { providerId, forceReauth });
      const res = await startOAuth(providerId, { forceReauth });
      // Prefer success URL even if the payload is oddly shaped.
      if (res?.authorizationUrl) {
        window.location.assign(res.authorizationUrl);
        return;
      }
      console.error("[SocialHub] connectSocialProvider failed", res);
      console.error("[SocialHub] connectSocialProvider failed JSON", JSON.stringify(res));
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
      await disconnectSocial(provider.id, provider.connection?.id);
      toast({ title: "Disconnected", description: `${provider.name} has been disconnected.` });
      await reload();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Disconnect failed",
        description: e?.message || "Please try again.",
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  const ig = providers.find((p) => p.id === "instagram");
  const anyConnected = providers.some((p) => p.status === "connected");
  const drafts = posts.filter(
    (p) =>
      p.status === POST_STATUS.DRAFT ||
      p.status === POST_STATUS.SCHEDULED ||
      p.status === POST_STATUS.PUBLISHING
  );
  const recent = posts.filter((p) => p.status === POST_STATUS.PUBLISHED || p.status === POST_STATUS.FAILED);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Share2 className="h-4 w-4 text-primary" />
          <span className="text-xs font-600 uppercase tracking-wider">Social</span>
        </div>
        <h1 className="mt-1 font-heading text-2xl font-700 tracking-tight">Social Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Instagram, TikTok, and YouTube, then publish or auto-schedule campaign posts.
        </p>
      </div>

      <section className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Connect at least one platform below. Schedule from Campaign Plan, or publish now from Compose.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="min-h-10 rounded-full"
            disabled={!anyConnected}
            onClick={() => navigate(buildComposePath())}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Social Post
          </Button>
          <Button size="sm" variant="outline" className="min-h-10 rounded-full" onClick={() => navigate("/campaigns")}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> View Campaign Content
          </Button>
          <Button size="sm" variant="outline" className="min-h-10 rounded-full" onClick={() => navigate("/releases")}>
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Releases & Calendar
          </Button>
        </div>
        {ig?.status === "connected" && ig?.needsPublishReauth && (
          <p className="mt-3 text-sm text-amber-600">
            Instagram granted:{" "}
            <code className="text-xs">{ig.connection?.scopes || "none"}</code>
            . Publishing needs{" "}
            <code className="text-xs">instagram_business_content_publish</code>. Reconnect and approve
            Instagram publish permission.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">
          Connected Accounts
        </h2>
        {loading ? (
          <div className="h-40 animate-shimmer rounded-2xl" />
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
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
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/50 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">
              Drafts & scheduled
            </h2>
          </div>
        </div>
        {loading ? (
          <div className="h-24 animate-shimmer rounded-xl" />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No drafts yet"
            description="Create a social post from a campaign day or schedule auto-publish in the campaign plan."
            action={
              <Button
                className="min-h-10 rounded-full"
                disabled={!anyConnected}
                onClick={() => navigate(buildComposePath())}
              >
                Create Social Post
              </Button>
            }
            className="border-0 bg-transparent p-2"
          />
        ) : (
          <ul className="space-y-2">
            {drafts.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={p.status} />
                    <span className="truncate text-sm font-600">{(p.caption || "Untitled").slice(0, 60)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {p.mediaType || "IMAGE"} · {p.provider || "instagram"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => navigate(`/social/compose?post=${p.id}`)}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/50 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">
            Recent posts
          </h2>
        </div>
        {loading ? (
          <div className="h-24 animate-shimmer rounded-xl" />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No published posts yet"
            description="Successful and failed publish attempts will appear here."
            className="border-0 bg-transparent p-2"
          />
        ) : (
          <ul className="space-y-2">
            {recent.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={p.status} />
                    <span className="truncate text-sm font-600">{(p.caption || "Untitled").slice(0, 60)}</span>
                  </div>
                  <p className="text-xs capitalize text-muted-foreground">{p.provider || "instagram"}</p>
                  {p.status === "failed" && (
                    <p className="text-xs text-destructive">{p.errorMessage || "Publishing failed"}</p>
                  )}
                  {p.status === "published" && p.externalPostId && (
                    <p className="text-xs text-muted-foreground">ID: {p.externalPostId}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.externalPermalink && (
                    <Button size="sm" variant="outline" className="rounded-full" asChild>
                      <a href={p.externalPermalink} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" /> View
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => navigate(`/social/compose?post=${p.id}`)}
                  >
                    Open
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
