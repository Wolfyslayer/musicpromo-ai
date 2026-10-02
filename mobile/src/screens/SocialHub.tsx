import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CalendarDays, Clock, ExternalLink, Plus, Send, Share2, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import { Screen, SectionTitle } from '@/components/Screen';
import SocialPlatformCard from '@/components/social/SocialPlatformCard';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { useAuth, useWorkspaceRefresh } from '@/lib/AuthContext';
import { buildComposePath, mergeProvidersWithConnections, POST_STATUS, startOAuth } from '@/services/socialService';
import { deleteSocialAccount, selectSocialWorkspace } from '@/services/studioRecords';
import ConfirmDialog from '@/components/ConfirmDialog';

const FUNCTIONS_ORIGIN = 'https://hmqxptxtcejhmuwbegvq.supabase.co/functions/v1';
const OAUTH_REDIRECTS = {
  instagram: `${FUNCTIONS_ORIGIN}/meta-oauth-callback`,
  tiktok: `${FUNCTIONS_ORIGIN}/tiktok-oauth-callback`,
  youtube: `${FUNCTIONS_ORIGIN}/youtube-oauth-callback`,
};

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Authorization was cancelled.',
  invalid_response: 'The authorization response was incomplete.',
  invalid_state: 'This connection request was invalid or expired. Please try again.',
  state_reused: 'This connection link was already used. Please try again.',
  expired_state: 'This connection request expired. Please try again.',
  not_configured: 'This platform is not configured on the server yet.',
  provider_error: 'Connection failed. Check app credentials and the OAuth redirect URI in the developer console.',
  client_init_failed: 'Server could not start the OAuth callback. Try again in a moment.',
  state_lookup_failed: 'Could not validate the login session. Try Connect again.',
  state_consume_failed: 'Could not finish the login session. Try Connect again.',
  token_exchange_failed: 'The provider rejected the login code. Confirm client ID/secret and that the redirect URI matches exactly.',
  bad_credentials: 'The provider rejected the app credentials. Check the secrets configured in Base44.',
  redirect_mismatch: `OAuth redirect URI mismatch. Register ${OAUTH_REDIRECTS.instagram} in Meta, ${OAUTH_REDIRECTS.tiktok} in TikTok, and ${OAUTH_REDIRECTS.youtube} in Google.`,
  profile_failed: 'Login succeeded but no account profile was returned. Check account type and try Connect again.',
  encrypt_failed: 'Could not store credentials. SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes as base64.',
  account_save_failed: 'Login worked, but saving the connection failed. Try Connect again.',
};

const CALLBACK_PARAM_KEYS = [
  'social_error',
  'error',
  'details',
  'meta',
  'social_connected',
  'social_warning',
  'social_debug_type',
  'social_debug_step',
  'social_debug_message',
  'social_debug_stack',
  'social_debug_meta',
  'provider',
];

const CONNECTABLE = new Set(['instagram', 'tiktok', 'youtube']);

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;

function PostRow({ post, onOpen, showResult }: { post: any; onOpen: () => void; showResult?: boolean }) {
  return (
    <View className="gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <StatusBadge status={post.status} />
        <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>
          {(post.caption || 'Untitled').slice(0, 60)}
        </Text>
      </View>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="text-xs capitalize text-muted-foreground">
            {showResult ? post.provider || 'instagram' : `${post.mediaType || 'IMAGE'} · ${post.provider || 'instagram'}`}
          </Text>
          {showResult && post.status === 'failed' ? <Text className="text-xs text-destructive">{post.errorMessage || 'Publishing failed'}</Text> : null}
          {showResult && post.status === 'published' && post.externalPostId ? <Text className="text-xs text-muted-foreground">ID: {post.externalPostId}</Text> : null}
        </View>
        <View className="flex-row gap-2">
          {showResult && post.externalPermalink ? (
            <Button size="sm" variant="outline" className="rounded-full" onPress={() => WebBrowser.openBrowserAsync(post.externalPermalink)}>
              <Icon as={ExternalLink} size={14} className="text-foreground" />
              <Text className="text-xs font-medium">View</Text>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="rounded-full" onPress={onOpen}>
            Open
          </Button>
        </View>
      </View>
    </View>
  );
}

export default function SocialHub() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { requireAuth, isAuthenticated } = useAuth();
  const [providers, setProviders] = useState<any[]>(() => mergeProvidersWithConnections([], {}));
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<any>(null);
  const loadedOnce = useRef(false);

  const reload = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const { connections, posts: savedPosts } = await selectSocialWorkspace();
      setProviders(mergeProvidersWithConnections(connections, {}));
      setPosts(savedPosts);
    } catch (e: any) {
      setProviders(mergeProvidersWithConnections([], {}));
      if (isAuthenticated) {
        toast({
          variant: 'destructive',
          title: 'Could not load social connections',
          description: e?.message || 'Connect may still work — try again if a platform fails.',
        });
      }
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
  useWorkspaceRefresh(reload);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => sub.remove();
  }, [reload]);

  const handleCallbackParams = useCallback(
    (p: Record<string, string | undefined>) => {
      const err = p.social_error || p.error;
      const ok = p.social_connected;
      const warn = p.social_warning;
      const details = p.details || p.social_debug_message;
      const meta = p.meta || p.social_debug_meta;
      const debugType = p.social_debug_type;
      if (!err && !ok && !warn && !details && !debugType) return false;

      if (err || details || meta || debugType) {
        const debugPayload = {
          success: false,
          errorType: debugType || err || 'provider_error',
          step: p.social_debug_step || null,
          message: details || (err && ERROR_MESSAGES[err]) || err || null,
          meta: meta || null,
          stack: p.social_debug_stack || null,
          social_error: err || null,
        };
        console.error('--- SOCIAL OAUTH DEBUG ERROR ---');
        console.error('Error Message:', debugPayload.message);
        console.error('Step:', debugPayload.step);
        console.error('Error Type:', debugPayload.errorType);
        if (debugPayload.meta) console.error('Provider API data:', debugPayload.meta);
        if (debugPayload.stack) console.error('Stack:', debugPayload.stack);
        console.error('Full Error Object:', JSON.stringify(debugPayload, null, 2));
      }

      const connectedLabel = ok === 'tiktok' ? 'TikTok' : ok === 'youtube' ? 'YouTube' : ok === 'instagram' ? 'Instagram' : ok || 'Account';

      if (warn === 'missing_publish_scope') {
        toast({
          variant: 'destructive',
          title: 'Connected without publishing',
          description: 'The provider only granted limited access. Reconnect and approve all publish permissions on the consent screen.',
        });
        reload();
      } else if (ok) {
        toast({ title: `${connectedLabel} connected`, description: 'Your account is linked to MusicPromo AI.' });
        reload();
      } else if (err) {
        toast({
          variant: 'destructive',
          title: `Connection failed (${err})`,
          description: details || ERROR_MESSAGES[err] || `Authorization error code: ${err}`,
        });
      }
      return true;
    },
    [reload]
  );

  useEffect(() => {
    const flat: Record<string, string | undefined> = {};
    CALLBACK_PARAM_KEYS.forEach((k) => {
      flat[k] = first(params[k]);
    });
    if (!handleCallbackParams(flat)) return;
    router.setParams(Object.fromEntries(CALLBACK_PARAM_KEYS.map((k) => [k, undefined])) as any);
  }, [params, handleCallbackParams, router]);

  const beginConnect = async (providerIdOrObj: any) => {
    const providerId = String(typeof providerIdOrObj === 'string' ? providerIdOrObj : providerIdOrObj?.id || '')
      .trim()
      .toLowerCase();
    const provider = providers.find((p) => p.id === providerId) || (typeof providerIdOrObj === 'object' ? providerIdOrObj : null);
    if (!CONNECTABLE.has(providerId)) return;
    setConnectingId(providerId);
    try {
      const forceReauth = provider?.needsPublishReauth === true || provider?.status === 'connected';
      console.info('[SocialHub] starting OAuth', { providerId, forceReauth });
      const res: any = await startOAuth(providerId, { forceReauth });
      if (res?.authorizationUrl) {
        const result = await WebBrowser.openAuthSessionAsync(res.authorizationUrl, Linking.createURL('/social'));
        if (result.type === 'success' && result.url) {
          const parsed = Linking.parse(result.url);
          const q: Record<string, string | undefined> = {};
          Object.entries(parsed.queryParams || {}).forEach(([k, v]) => {
            q[k] = first(v);
          });
          handleCallbackParams(q);
        }
        await reload();
        return;
      }
      console.error('[SocialHub] connectSocialProvider failed', res);
      console.error('[SocialHub] connectSocialProvider failed JSON', JSON.stringify(res));
      const detailParts = [
        res?.error || res?.message || 'OAuth start failed.',
        res?.provider ? `Got: ${res.provider}.` : null,
        Array.isArray(res?.supported) ? `Supported: ${res.supported.join(', ')}.` : null,
        res?.bodyKeys ? `Body keys: ${res.bodyKeys.join(', ')}.` : null,
      ].filter(Boolean);
      toast({
        variant: 'destructive',
        title: res?.code === 'not_configured' ? `${provider?.name || providerId} not configured` : `Could not start ${provider?.name || providerId} connection`,
        description: detailParts.join(' '),
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: `Could not start ${provider?.name || providerId} connection`,
        description: e?.message || 'Please try again.',
      });
    } finally {
      setConnectingId(null);
    }
  };

  const onConnect = (providerIdOrObj: any) => {
    requireAuth(() => beginConnect(providerIdOrObj));
  };

  const runDisconnect = async (provider: any) => {
    if (!CONNECTABLE.has(provider.id)) return;
    setDisconnectingId(provider.id);
    try {
      if (provider.connection?.id) await deleteSocialAccount(provider.connection.id);
      toast({ title: 'Disconnected', description: `${provider.name} has been disconnected.` });
      await reload();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Disconnect failed',
        description: e?.message || 'Please try again.',
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  const ig = providers.find((p) => p.id === 'instagram');
  const anyConnected = providers.some((p) => p.status === 'connected');
  const drafts = posts.filter((p) => p.status === POST_STATUS.DRAFT || p.status === POST_STATUS.SCHEDULED || p.status === POST_STATUS.PUBLISHING);
  const recent = posts.filter((p) => p.status === POST_STATUS.PUBLISHED || p.status === POST_STATUS.FAILED);
  const openCompose = () => router.push(buildComposePath() as any);

  return (
    <Screen tabScreen onRefresh={reload}>
      <View>
        <View className="flex-row items-center gap-2">
          <Icon as={Share2} size={16} className="text-primary" />
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Social</Text>
        </View>
        <Text className="mt-1 font-heading-bold text-2xl tracking-tight">Social Hub</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Connect Instagram, TikTok, and YouTube, then publish or auto-schedule campaign posts.</Text>
      </View>

      <View className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <Text className="text-sm text-muted-foreground">Connect at least one platform below. Schedule from Campaign Plan, or publish now from Compose.</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Button size="sm" className="rounded-full" disabled={!anyConnected} onPress={openCompose}>
            <Icon as={Plus} size={14} className="text-primary-foreground" />
            <Text className="text-xs font-medium text-primary-foreground">Create Social Post</Text>
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onPress={() => router.push('/campaigns')}>
            <Icon as={Sparkles} size={14} className="text-foreground" />
            <Text className="text-xs font-medium">View Campaign Content</Text>
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onPress={() => router.push('/releases')}>
            <Icon as={CalendarDays} size={14} className="text-foreground" />
            <Text className="text-xs font-medium">Releases & Calendar</Text>
          </Button>
        </View>
        {ig?.status === 'connected' && ig?.needsPublishReauth ? (
          <Text className="mt-3 text-sm text-amber-600">
            Instagram granted: {ig.connection?.scopes || 'none'}. Publishing needs instagram_business_content_publish. Reconnect and approve Instagram publish permission.
          </Text>
        ) : null}
      </View>

      <View>
        <SectionTitle>Connected Accounts</SectionTitle>
        {loading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : (
          <View className="gap-3">
            {providers.map((provider) => (
              <SocialPlatformCard
                key={provider.id}
                provider={provider}
                onConnect={CONNECTABLE.has(provider.id) ? onConnect : undefined}
                onDisconnect={CONNECTABLE.has(provider.id) ? (p) => setDisconnectTarget(p) : undefined}
                connecting={connectingId === provider.id}
                disconnecting={disconnectingId === provider.id}
              />
            ))}
          </View>
        )}
      </View>

      <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <View className="mb-3 flex-row items-center gap-2">
          <Icon as={Clock} size={16} className="text-primary" />
          <Text className="font-heading text-sm uppercase tracking-wider text-muted-foreground">Drafts & scheduled</Text>
        </View>
        {loading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No drafts yet"
            description="Create a social post from a campaign day or schedule auto-publish in the campaign plan."
            action={
              <Button className="rounded-full" disabled={!anyConnected} onPress={openCompose}>
                Create Social Post
              </Button>
            }
            className="border-0 bg-transparent p-2"
          />
        ) : (
          <View className="gap-2">
            {drafts.map((p) => (
              <PostRow key={p.id} post={p} onOpen={() => router.push(`/social/compose?post=${p.id}` as any)} />
            ))}
          </View>
        )}
      </View>

      <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <View className="mb-3 flex-row items-center gap-2">
          <Icon as={Share2} size={16} className="text-primary" />
          <Text className="font-heading text-sm uppercase tracking-wider text-muted-foreground">Recent posts</Text>
        </View>
        {loading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : recent.length === 0 ? (
          <EmptyState icon={Share2} title="No published posts yet" description="Successful and failed publish attempts will appear here." className="border-0 bg-transparent p-2" />
        ) : (
          <View className="gap-2">
            {recent.map((p) => (
              <PostRow key={p.id} post={p} showResult onOpen={() => router.push(`/social/compose?post=${p.id}` as any)} />
            ))}
          </View>
        )}
      </View>

      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        onOpenChange={(o) => {
          if (!o) setDisconnectTarget(null);
        }}
        title={`Disconnect ${disconnectTarget?.name || 'account'}?`}
        description="You will need to reconnect before publishing or syncing stats for this platform."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => {
          const target = disconnectTarget;
          setDisconnectTarget(null);
          if (target) runDisconnect(target);
        }}
      />
    </Screen>
  );
}
