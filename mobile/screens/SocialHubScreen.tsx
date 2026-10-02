import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { CalendarDays, Clock, ExternalLink, Plus, Send, Share2, Sparkles } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import SocialPlatformCard from '@/components/social/SocialPlatformCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { OAUTH_REDIRECTS } from '@/lib/oauthRedirects';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/toast';
import { deleteSocialAccount, selectSocialWorkspace } from '@/services/studioRecords';
import {
  startOAuth,
  mergeProvidersWithConnections,
  buildComposePath,
  POST_STATUS,
} from '@/services/socialService';

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Authorization was cancelled.',
  invalid_response: 'The authorization response was incomplete.',
  invalid_state: 'This connection request was invalid or expired. Please try again.',
  state_reused: 'This connection link was already used. Please try again.',
  expired_state: 'This connection request expired. Please try again.',
  not_configured: 'This platform is not configured on the server yet.',
  provider_error:
    'Connection failed. Check app credentials and the OAuth redirect URI in the developer console.',
  client_init_failed: 'Server could not start the OAuth callback. Try again in a moment.',
  state_lookup_failed: 'Could not validate the login session. Try Connect again.',
  state_consume_failed: 'Could not finish the login session. Try Connect again.',
  token_exchange_failed:
    'The provider rejected the login code. Confirm client ID/secret and that the redirect URI matches exactly.',
  bad_credentials: 'The provider rejected the app credentials. Check the secrets configured in Base44.',
  redirect_mismatch: `OAuth redirect URI mismatch. Register ${OAUTH_REDIRECTS.instagram} in Meta, ${OAUTH_REDIRECTS.tiktok} in TikTok, and ${OAUTH_REDIRECTS.youtube} in Google.`,
  profile_failed:
    'Login succeeded but no account profile was returned. Check account type and try Connect again.',
  encrypt_failed:
    'Could not store credentials. SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes as base64.',
  account_save_failed: 'Login worked, but saving the connection failed. Try Connect again.',
};

const CONNECTABLE = new Set(['instagram', 'tiktok', 'youtube']);

export default function SocialHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const { toast } = useToast();
  const { requireAuth, isAuthenticated } = useAuth();
  const [providers, setProviders] = useState(() => mergeProvidersWithConnections([], {}));
  const [posts, setPosts] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { connections, posts: savedPosts } = await selectSocialWorkspace();
      setProviders(mergeProvidersWithConnections(connections, {}));
      setPosts(savedPosts as Array<Record<string, unknown>>);
    } catch (e) {
      setProviders(mergeProvidersWithConnections([], {}));
      if (isAuthenticated) {
        toast({
          title: 'Could not load social connections',
          description: e instanceof Error ? e.message : 'Connect may still work — try again if a platform fails.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast, isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useEffect(() => {
    const err = params.social_error || params.error;
    const ok = params.social_connected;
    const warn = params.social_warning;
    const details = params.details || params.social_debug_message;
    if (!err && !ok && !warn && !details) return;

    const connectedLabel =
      ok === 'tiktok' ? 'TikTok' : ok === 'youtube' ? 'YouTube' : ok === 'instagram' ? 'Instagram' : ok || 'Account';

    if (warn === 'missing_publish_scope') {
      toast({
        title: 'Connected without publishing',
        description:
          'The provider only granted limited access. Reconnect and approve all publish permissions on the consent screen.',
      });
      reload();
    } else if (ok) {
      toast({ title: `${connectedLabel} connected`, description: 'Your account is linked to MusicPromo AI.' });
      reload();
    } else if (err) {
      toast({
        title: `Connection failed (${err})`,
        description: details || ERROR_MESSAGES[String(err)] || `Authorization error code: ${err}`,
      });
    }
  }, [params, toast, reload]);

  const beginConnect = async (providerIdOrObj: string | { id?: string; name?: string }) => {
    const providerId = String(typeof providerIdOrObj === 'string' ? providerIdOrObj : providerIdOrObj?.id || '')
      .trim()
      .toLowerCase();
    const provider =
      providers.find((p) => p.id === providerId) ||
      (typeof providerIdOrObj === 'object' ? providerIdOrObj : null);
    if (!CONNECTABLE.has(providerId)) return;
    setConnectingId(providerId);
    try {
      const forceReauth =
        (provider as { needsPublishReauth?: boolean; status?: string })?.needsPublishReauth === true ||
        (provider as { status?: string })?.status === 'connected';
      const res = await startOAuth(providerId, { forceReauth });
      if (res?.authorizationUrl) {
        await WebBrowser.openBrowserAsync(res.authorizationUrl);
        return;
      }
      toast({
        title:
          res?.code === 'not_configured'
            ? `${(provider as { name?: string })?.name || providerId} not configured`
            : `Could not start ${(provider as { name?: string })?.name || providerId} connection`,
        description: res?.error || res?.message || 'OAuth start failed.',
      });
    } catch (e) {
      toast({
        title: `Could not start ${(provider as { name?: string })?.name || providerId} connection`,
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setConnectingId(null);
    }
  };

  const onConnect = (providerIdOrObj: string | { id?: string }) => {
    requireAuth(() => beginConnect(providerIdOrObj));
  };

  const onDisconnect = async (provider: { id: string; name?: string; connection?: { id?: string } }) => {
    if (!CONNECTABLE.has(provider.id)) return;
    setDisconnectingId(provider.id);
    try {
      if (provider.connection?.id) await deleteSocialAccount(provider.connection.id);
      toast({ title: 'Disconnected', description: `${provider.name} has been disconnected.` });
      await reload();
    } catch (e) {
      toast({
        title: 'Disconnect failed',
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  const anyConnected = providers.some((p) => p.status === 'connected');
  const drafts = posts.filter(
    (p) =>
      p.status === POST_STATUS.DRAFT ||
      p.status === POST_STATUS.SCHEDULED ||
      p.status === POST_STATUS.PUBLISHING,
  );
  const recent = posts.filter((p) => p.status === POST_STATUS.PUBLISHED || p.status === POST_STATUS.FAILED);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4">
      <View>
        <View className="flex-row items-center gap-2">
          <Share2 color="#8b5cf6" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Social</Text>
        </View>
        <Text className="mt-1 text-2xl font-bold text-foreground">Social Hub</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Connect Instagram, TikTok, and YouTube, then publish or auto-schedule campaign posts.
        </Text>
      </View>

      <View className="rounded-2xl border border-border bg-muted/20 p-4">
        <Text className="text-sm text-muted-foreground">
          Connect at least one platform below. Schedule from Campaign Plan, or publish now from Compose.
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Button
            label="Create Social Post"
            disabled={!anyConnected}
            onPress={() => router.push(buildComposePath() as never)}
          />
          <Button variant="outline" label="View Campaign Content" onPress={() => router.push('/campaigns')} />
          <Button variant="outline" label="Releases & Calendar" onPress={() => router.push('/releases')} />
        </View>
      </View>

      <View className="gap-3">
        <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Connected Accounts</Text>
        {loading ? (
          <ActivityIndicator className="py-10" />
        ) : (
          providers.map((provider) => (
            <SocialPlatformCard
              key={provider.id}
              provider={provider}
              onConnect={CONNECTABLE.has(provider.id) ? onConnect : undefined}
              onDisconnect={CONNECTABLE.has(provider.id) ? onDisconnect : undefined}
              connecting={connectingId === provider.id}
              disconnecting={disconnectingId === provider.id}
            />
          ))
        )}
      </View>

      <View className="rounded-2xl border border-border bg-card/50 p-5">
        <View className="mb-3 flex-row items-center gap-2">
          <Clock color="#8b5cf6" size={16} />
          <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Drafts & scheduled</Text>
        </View>
        {loading ? (
          <ActivityIndicator />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No drafts yet"
            description="Create a social post from a campaign day or schedule auto-publish in the campaign plan."
            action={
              <Button
                label="Create Social Post"
                disabled={!anyConnected}
                onPress={() => router.push(buildComposePath() as never)}
              />
            }
            className="border-0 bg-transparent p-2"
          />
        ) : (
          drafts.map((p) => (
            <View
              key={String(p.id)}
              className="mb-2 flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2"
            >
              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <StatusBadge status={String(p.status || 'draft')} />
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {String(p.caption || 'Untitled').slice(0, 60)}
                  </Text>
                </View>
                <Text className="text-xs capitalize text-muted-foreground">
                  {String(p.mediaType || 'IMAGE')} · {String(p.provider || 'instagram')}
                </Text>
              </View>
              <Button
                variant="outline"
                label="Open"
                onPress={() => router.push(`/social/compose?post=${p.id}` as never)}
              />
            </View>
          ))
        )}
      </View>

      <View className="rounded-2xl border border-border bg-card/50 p-5">
        <View className="mb-3 flex-row items-center gap-2">
          <Share2 color="#8b5cf6" size={16} />
          <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent posts</Text>
        </View>
        {loading ? (
          <ActivityIndicator />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No published posts yet"
            description="Successful and failed publish attempts will appear here."
            className="border-0 bg-transparent p-2"
          />
        ) : (
          recent.map((p) => (
            <View
              key={String(p.id)}
              className="mb-2 flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2"
            >
              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <StatusBadge status={String(p.status || '')} />
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {String(p.caption || 'Untitled').slice(0, 60)}
                  </Text>
                </View>
                <Text className="text-xs capitalize text-muted-foreground">{String(p.provider || 'instagram')}</Text>
                {p.status === 'failed' ? (
                  <Text className="text-xs text-destructive">{String(p.errorMessage || 'Publishing failed')}</Text>
                ) : null}
              </View>
              <View className="flex-row gap-2">
                {p.externalPermalink ? (
                  <Button
                    variant="outline"
                    label="View"
                    onPress={() => Linking.openURL(String(p.externalPermalink))}
                  />
                ) : null}
                <Button
                  variant="outline"
                  label="Open"
                  onPress={() => router.push(`/social/compose?post=${p.id}` as never)}
                />
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
