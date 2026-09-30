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
  getProviders,
  loadPosts,
  buildComposePath,
  POST_STATUS,
} from "@/services/socialService";
import SocialPlatformCard from "@/components/social/SocialPlatformCard";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

const ERROR_MESSAGES = {
  cancelled: "Instagram authorization was cancelled.",
  invalid_response: "The authorization response was incomplete.",
  invalid_state: "This connection request was invalid or expired. Please try again.",
  state_reused: "This connection link was already used. Please try again.",
  expired_state: "This connection request expired. Please try again.",
  not_configured: "Instagram is not configured on the server yet.",
  provider_error:
    "Instagram connection failed at an unknown step. Check Meta Instagram App ID/Secret, redirect URI, and tester invite.",
  client_init_failed: "Server could not start the Instagram callback. Try again in a moment.",
  state_lookup_failed: "Could not validate the login session. Try Connect again.",
  state_consume_failed: "Could not finish the login session. Try Connect again.",
  token_exchange_failed:
    "Instagram rejected the login code. Confirm Instagram App ID/Secret and that the redirect URI matches exactly on the new Meta app.",
  bad_credentials:
    "Meta rejected the app credentials. META_CLIENT_ID must be the Instagram App ID and META_CLIENT_SECRET the Instagram App Secret (Business login settings — not Facebook app id/secret).",
  redirect_mismatch:
    "OAuth redirect URI mismatch. Add exactly https://flying-sonic-promo-flow.base44.app/functions/socialOAuthCallback to the new app’s Business login settings.",
  profile_failed:
    "Logged in with Instagram, but profile lookup failed. Add your account as an Instagram Tester on the new app and accept the invite.",
  encrypt_failed:
    "Could not store Instagram credentials. SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes as base64 (do not replace it with the Meta secret).",
  account_save_failed: "Instagram login worked, but saving the connection failed. Try Connect again.",
};

/**
 * Social Hub — Instagram connect + publish drafts/status; other providers remain unavailable.
 */
export default function SocialHub() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const [providers, setProviders] = useState(() => getProviders());
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
      setProviders(
        mergeProvidersWithConnections(data?.connections || [], data?.providersConfigured || {})
      );
      setPosts(postData?.posts || []);
    } catch (e) {
      setProviders(getProviders());
      toast({
        variant: "destructive",
        title: "Could not load social connections",
        description: e?.message || "Please refresh and try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const err = params.get("social_error");
    const ok = params.get("social_connected");
    const warn = params.get("social_warning");
    if (!err && !ok && !warn) return;

    if (warn === "missing_publish_scope") {
      toast({
        variant: "destructive",
        title: "Connected without publishing",
        description:
          "Instagram only granted basic access. On the consent screen, turn ON both toggles (profile + publish content), then reconnect.",
      });
      reload();
    } else if (ok) {
      toast({ title: "Instagram connected", description: "Your account is linked to MusicPromo AI." });
      reload();
    } else if (err) {
      toast({
        variant: "destructive",
        title: `Connection failed (${err})`,
        description: ERROR_MESSAGES[err] || `Authorization error code: ${err}`,
      });
    }

    const next = new URLSearchParams(params);
    next.delete("social_error");
    next.delete("social_connected");
    next.delete("social_warning");
    setParams(next, { replace: true });
  }, [params, setParams, toast, reload]);

  const onConnect = async (provider) => {
    if (provider.id !== "instagram") return;
    setConnectingId(provider.id);
    try {
      // Scope upgrades need force_reauth; otherwise Instagram silent-reuses old grants.
      const forceReauth = provider.needsPublishReauth === true || provider.status === "connected";
      const res = await startOAuth(provider.id, { forceReauth });
      if (res?.code === "not_configured" || res?.error) {
        toast({
          variant: "destructive",
          title: "Instagram not configured",
          description: res.error || "Add Meta secrets in Base44 first.",
        });
        return;
      }
      if (!res?.authorizationUrl) {
        toast({ variant: "destructive", title: "Could not start Instagram connection" });
        return;
      }
      window.location.assign(res.authorizationUrl);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not start Instagram connection",
        description: e?.message || "Please try again.",
      });
    } finally {
      setConnectingId(null);
    }
  };

  const onDisconnect = async (provider) => {
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
  const igConnected = ig?.status === "connected";
  const drafts = posts.filter((p) => p.status === POST_STATUS.DRAFT || p.status === POST_STATUS.PUBLISHING);
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
          Manage connected platforms and publish Instagram posts from campaign days.
        </p>
      </div>

      <section className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Create promotional content in your campaigns, then publish Instagram image posts from public JPEG artwork.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="min-h-10 rounded-full"
            disabled={!igConnected}
            onClick={() => navigate(buildComposePath())}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Instagram Post
          </Button>
          <Button size="sm" variant="outline" className="min-h-10 rounded-full" onClick={() => navigate("/campaigns")}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> View Campaign Content
          </Button>
          <Button size="sm" variant="outline" className="min-h-10 rounded-full" onClick={() => navigate("/releases")}>
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Releases & Calendar
          </Button>
        </div>
        {igConnected && ig?.needsPublishReauth && (
          <p className="mt-3 text-sm text-amber-600">
            Instagram granted:{" "}
            <code className="text-xs">{ig.connection?.scopes || "none"}</code>
            . Publishing needs <code className="text-xs">instagram_business_content_publish</code>.
            Meta is not putting publish on your token yet — see reconnect steps below the accounts list.
          </p>
        )}
        {igConnected && ig?.needsPublishReauth && (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Instagram app → Settings → Apps and websites → accept the <span className="font-600">MusicPromo AI-IG</span>{" "}
              tester invite if pending.
            </li>
            <li>
              Meta dashboard → Instagram → API setup → <span className="font-600">Generate access tokens</span> → add{" "}
              <span className="font-600">@wolfyslayermusic</span> and confirm publish is available there.
            </li>
            <li>
              Disconnect here, reconnect, and on the consent screen turn <span className="font-600">both</span> toggles ON
              (profile + publicera innehåll) before Tillåt.
            </li>
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">
          Connected Accounts
        </h2>
        {loading ? (
          <div className="h-40 animate-shimmer rounded-2xl" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((provider) => (
              <SocialPlatformCard
                key={provider.id}
                provider={provider}
                onConnect={provider.id === "instagram" ? onConnect : undefined}
                onDisconnect={provider.id === "instagram" ? onDisconnect : undefined}
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
              Instagram drafts & publishing
            </h2>
          </div>
        </div>
        {loading ? (
          <div className="h-24 animate-shimmer rounded-xl" />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No drafts yet"
            description="Create a social post from a campaign day or start a new Instagram draft."
            action={
              <Button
                className="min-h-10 rounded-full"
                disabled={!igConnected}
                onClick={() => navigate(buildComposePath())}
              >
                Create Instagram Post
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
                  <p className="text-xs text-muted-foreground">{p.mediaType || "IMAGE"} · Instagram</p>
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
            Recent Instagram posts
          </h2>
        </div>
        {loading ? (
          <div className="h-24 animate-shimmer rounded-xl" />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No published posts yet"
            description="Successful and failed Instagram publish attempts will appear here."
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
