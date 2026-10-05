import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import {
  startOAuth,
  getConnectionStatus,
  mergeProvidersWithConnections,
  normalizeSocialConnection,
  OAUTH_PROVIDERS,
  POST_STATUS,
} from "@/services/socialService";
import { deleteSocialAccount, selectSocialWorkspace } from "@/services/studioRecords";
import { getSocialArtistId, setSocialArtistId } from "@/services/socialArtistScope";
import { assignLegacySocialToArtistIfNeeded } from "@/services/artistSocial";
import { loadArtists } from "@/services/data";
import { OAUTH_REDIRECTS } from "@/lib/oauthRedirects";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { SOCIAL_PROVIDERS } from "@/services/social/providers";

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
  artist_required: "Select an artist in Social Hub, then connect again.",
  state_lookup_failed: "Could not validate the login session. Try Connect again.",
  state_consume_failed: "Could not finish the login session. Try Connect again.",
  token_exchange_failed:
    "The provider rejected the login code. Confirm client ID/secret and that the redirect URI matches exactly.",
  bad_credentials:
    "The provider rejected the app credentials. Check the secrets configured in Base44.",
  redirect_mismatch: `OAuth redirect URI mismatch. Register ${OAUTH_REDIRECTS.instagram} in Meta, ${OAUTH_REDIRECTS.tiktok} in TikTok, and ${OAUTH_REDIRECTS.youtube} in Google.`,
  profile_failed:
    "Login succeeded but no account profile was returned. Check account type and try Connect again.",
  encrypt_failed:
    "Could not store credentials. SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes as base64.",
  account_save_failed: "Login worked, but saving the connection failed. Try Connect again.",
};

/** Platforms with OAuth implemented in connectSocialProvider — keep in sync via providers.js */
export const CONNECTABLE_SOCIAL = new Set(
  SOCIAL_PROVIDERS.filter((p) => p.oauthImplemented).map((p) => p.id)
);

const SocialHubContext = createContext(null);

export function SocialHubProvider({ children }) {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const { requireAuth, isAuthenticated } = useAuth();
  const [providers, setProviders] = useState(() => mergeProvidersWithConnections([], {}));
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);
  const [socialArtistId, setSocialArtistIdState] = useState(() => getSocialArtistId());
  const [artists, setArtists] = useState([]);

  const selectSocialArtist = useCallback((artistId) => {
    const id = String(artistId || "");
    setSocialArtistId(id);
    setSocialArtistIdState(id);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadArtists()
      .then((list) => {
        setArtists(list);
        if (list.length && !getSocialArtistId()) {
          selectSocialArtist(list[0].id);
        }
      })
      .catch(() => setArtists([]));
  }, [isAuthenticated, selectSocialArtist]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { connections: dbConnections, posts: savedPosts } = await selectSocialWorkspace();
      let connections = (dbConnections || []).map(normalizeSocialConnection);
      let providersConfigured = {};
      try {
        const status = await getConnectionStatus();
        if (Array.isArray(status?.connections) && status.connections.length) {
          connections = status.connections.map(normalizeSocialConnection);
        }
        if (status?.providersConfigured) providersConfigured = status.providersConfigured;
      } catch {
        /* fall back to client-side social_accounts rows */
      }
      setProviders(mergeProvidersWithConnections(connections, providersConfigured, socialArtistId));
      setPosts(savedPosts);
    } catch (e) {
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
  }, [toast, isAuthenticated, socialArtistId]);

  useEffect(() => {
    reload();
  }, [reload]);
  useWorkspaceRefresh(reload);

  useEffect(() => {
    if (!isAuthenticated || artists.length !== 1) return;
    const artistId = artists[0]?.id;
    if (!artistId) return;
    assignLegacySocialToArtistIfNeeded(artistId).then(({ updated }) => {
      if (updated > 0) reload();
    });
  }, [isAuthenticated, artists, reload]);

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
      console.error("--- SOCIAL OAUTH DEBUG ERROR ---", debugPayload);
    }

    const connectedLabel =
      ok === "tiktok"
        ? "TikTok"
        : ok === "youtube"
          ? "YouTube"
          : ok === "instagram"
            ? "Instagram"
            : ok === "x"
                ? "X"
                : ok || "Account";

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
    if (!OAUTH_PROVIDERS.has(providerId)) {
      toast({
        variant: "destructive",
        title: `${provider?.name || providerId || "Platform"} is not connectable yet`,
        description: "This platform is not enabled in the app. Refresh the page and try again.",
      });
      return;
    }
    if (!socialArtistId) {
      toast({
        variant: "destructive",
        title: "Select an artist",
        description: "Social accounts are linked per artist — choose one above before connecting.",
      });
      return;
    }
    setConnectingId(providerId);
    try {
      const forceReauth =
        provider?.needsPublishReauth === true || provider?.status === "connected";
      const res = await startOAuth(providerId, { forceReauth, artistId: socialArtistId });
      const authUrl = res?.authorizationUrl ? String(res.authorizationUrl).trim() : "";
      if (authUrl) {
        window.location.assign(authUrl);
        return;
      }
      console.error("[social] OAuth start failed", { providerId, res });
      const missing = res?.missing && typeof res.missing === "object" ? res.missing : null;
      const missingLabels = missing
        ? Object.entries(missing)
            .filter(([, isMissing]) => isMissing)
            .map(([name]) => name)
        : [];
      const detailParts = [
        res?.error || res?.message || "OAuth start failed.",
        missingLabels.length
          ? `Set in Supabase → Edge Functions → Secrets: ${missingLabels.join(", ")}.`
          : null,
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

  const onConnect = (providerIdOrObj) =>
    requireAuth(() => beginConnect(providerIdOrObj));

  const onDisconnect = async (provider) => {
    if (!OAUTH_PROVIDERS.has(provider.id)) return;
    setDisconnectingId(provider.id);
    try {
      if (provider.connection?.id) await deleteSocialAccount(provider.connection.id);
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

  const value = useMemo(
    () => ({
      providers,
      posts,
      loading,
      connectingId,
      disconnectingId,
      reload,
      artists,
      socialArtistId,
      selectSocialArtist,
      onConnect,
      onDisconnect,
      ig,
      anyConnected,
      drafts,
      recent,
    }),
    [
      providers,
      posts,
      loading,
      connectingId,
      disconnectingId,
      reload,
      ig,
      anyConnected,
      drafts,
      recent,
    ]
  );

  return <SocialHubContext.Provider value={value}>{children}</SocialHubContext.Provider>;
}

export function useSocialHub() {
  const ctx = useContext(SocialHubContext);
  if (!ctx) throw new Error("useSocialHub must be used within SocialHubProvider");
  return ctx;
}
