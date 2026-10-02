import * as Linking from 'expo-linking';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Camera, Send } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';

import { db } from '@/api/base44Client';
import ArtworkImage from '@/components/ArtworkImage';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Screen, SectionTitle } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  getInstagramPublishBlocker as getInstagramPublishBlockerRaw,
  getMediaPreparationHint,
  INSTAGRAM_CAPTION_MAX,
  looksLikeJpegUrl,
  looksLikePngOrWebpUrl,
  validateDraftFields,
} from '@/services/social/publishValidation';
import { createPost, getConnectionStatus, loadPost, POST_STATUS, publishPost, startOAuth, updatePost } from '@/services/socialService';

const getInstagramPublishBlocker = getInstagramPublishBlockerRaw as (args: any) => string | null;

const first = (v: unknown) => ((Array.isArray(v) ? v[0] : v) as string | undefined) || '';

function InfoBox({ className, children }: { className?: string; children: React.ReactNode }) {
  return <View className={cn('rounded-2xl border border-border/60 bg-muted/20 p-4', className)}>{children}</View>;
}

function ContextItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="w-1/2 pr-2">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      {typeof children === 'string' ? <Text className="text-sm font-semibold">{children}</Text> : children}
    </View>
  );
}

export default function SocialCompose() {
  const router = useRouter();
  const search = useLocalSearchParams();

  const dayId = first(search.day);
  const campaignIdParam = first(search.campaign);
  const releaseIdParam = first(search.release);
  const postIdParam = first(search.post);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [instagram, setInstagram] = useState<any>(null);
  const [day, setDay] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [release, setRelease] = useState<any>(null);
  const [song, setSong] = useState<any>(null);
  const [generated, setGenerated] = useState<any[]>([]);
  const [video, setVideo] = useState<any>(null);

  const [post, setPost] = useState<any>(null);
  const [caption, setCaption] = useState('');
  const [captionSource, setCaptionSource] = useState('day');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('IMAGE');
  const bootstrapped = useRef(false);

  const artworkOptions = useMemo(() => {
    const opts: { id: string; label: string; url: string }[] = [];
    if (release?.artwork_url) opts.push({ id: 'release', label: 'Release artwork', url: release.artwork_url });
    if (song?.artwork_url && song.artwork_url !== release?.artwork_url) opts.push({ id: 'song', label: 'Song artwork', url: song.artwork_url });
    return opts;
  }, [release, song]);

  const videoReady = video && video.rendering_status === 'complete' && video.render_output_url && /^https:\/\//i.test(video.render_output_url);

  const publishBlocker = getInstagramPublishBlocker({
    instagram,
    post,
    mediaUrl,
    mediaType,
    videoReady: Boolean(videoReady),
  });
  const preparationHint = getMediaPreparationHint(mediaUrl, mediaType);

  const refreshInstagram = useCallback(async () => {
    try {
      const status: any = await getConnectionStatus();
      const ig = (status?.connections || []).find((c: any) => c.provider === 'instagram' && c.status === 'connected');
      setInstagram(ig || null);
    } catch {}
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const status: any = await getConnectionStatus();
      const ig = (status?.connections || []).find((c: any) => c.provider === 'instagram' && c.status === 'connected');
      setInstagram(ig || null);

      if (postIdParam) {
        const res: any = await loadPost(postIdParam);
        const p = res?.post;
        if (p) {
          setPost(p);
          setCaption(p.caption || '');
          setMediaUrl(p.mediaUrl || '');
          setMediaType(p.mediaType || 'IMAGE');
        }
      }

      let dayRow: any = null;
      let campaignRow: any = null;
      let releaseRow: any = null;
      let songRow: any = null;

      if (dayId) {
        dayRow = await db.entities.CampaignDay.get(dayId);
        setDay(dayRow);
      }
      const campaignId = campaignIdParam || dayRow?.campaign_id;
      if (campaignId) {
        campaignRow = await db.entities.Campaign.get(campaignId);
        setCampaign(campaignRow);
      }
      const releaseId = releaseIdParam || campaignRow?.release_id;
      if (releaseId) {
        releaseRow = await db.entities.Release.get(releaseId).catch(() => null);
        setRelease(releaseRow);
      }
      if (campaignRow?.song_id) {
        songRow = await db.entities.Song.get(campaignRow.song_id).catch(() => null);
        setSong(songRow);
      }

      if (campaignId) {
        const content = await db.entities.GeneratedContent.filter({ campaign_id: campaignId }, '-created_date', 50).catch(() => []);
        setGenerated((content || []).filter((c: any) => c.type === 'caption' || !c.type));
      }

      if (dayRow?.video_project_id) {
        const vp = await db.entities.VideoProject.get(dayRow.video_project_id).catch(() => null);
        setVideo(vp);
      }

      if (!postIdParam) {
        const parts = [dayRow?.caption, dayRow?.hashtags, dayRow?.cta].filter(Boolean);
        setCaption(parts.join('\n\n').slice(0, INSTAGRAM_CAPTION_MAX));
        setCaptionSource('day');
        const art = releaseRow?.artwork_url || songRow?.artwork_url || '';
        setMediaUrl(art);
        setMediaType('IMAGE');
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not load composer',
        description: e?.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
      bootstrapped.current = true;
    }
  }, [campaignIdParam, dayId, postIdParam, releaseIdParam]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useFocusEffect(
    useCallback(() => {
      if (bootstrapped.current) refreshInstagram();
    }, [refreshInstagram])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && bootstrapped.current) refreshInstagram();
    });
    return () => sub.remove();
  }, [refreshInstagram]);

  const onSelectCaptionSource = (value: string) => {
    setCaptionSource(value);
    if (value === 'day' && day) {
      const parts = [day.caption, day.hashtags, day.cta].filter(Boolean);
      setCaption(parts.join('\n\n').slice(0, INSTAGRAM_CAPTION_MAX));
    } else if (value.startsWith('gc:')) {
      const id = value.slice(3);
      const item = generated.find((g) => g.id === id);
      if (item?.content) setCaption(String(item.content).slice(0, INSTAGRAM_CAPTION_MAX));
    }
  };

  const onSelectArtwork = (url: string) => {
    setMediaUrl(url);
    setMediaType('IMAGE');
  };

  const saveDraft = async () => {
    const draftCheck: any = validateDraftFields({ caption });
    if (!draftCheck.ok) {
      toast({ variant: 'destructive', title: 'Could not save draft', description: draftCheck.message });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        provider: 'instagram',
        socialAccountId: instagram?.id || '',
        campaignId: campaign?.id || campaignIdParam || '',
        campaignDayId: day?.id || dayId || '',
        releaseId: release?.id || releaseIdParam || '',
        caption,
        mediaUrl: mediaUrl || '',
        mediaType,
        videoProjectId: video?.id || day?.video_project_id || '',
        generatedContentId: captionSource.startsWith('gc:') ? captionSource.slice(3) : '',
        contentType: day?.content_type || '',
      };

      let res: any;
      if (post?.id) {
        res = await updatePost({ postId: post.id, ...payload });
      } else {
        res = await createPost(payload);
      }
      if (res?.error) {
        toast({ variant: 'destructive', title: 'Could not save draft', description: res.error });
        return;
      }
      setPost(res.post);
      toast({ title: 'Draft saved', description: 'You can keep editing. Publish when media and Instagram are ready.' });
      if (res.post?.id && !postIdParam) {
        router.replace(`/social/compose?post=${res.post.id}` as any);
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not save draft',
        description: e?.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const requestPublish = () => {
    const blocker = getInstagramPublishBlocker({
      instagram,
      post,
      mediaUrl,
      mediaType,
      videoReady: Boolean(videoReady),
    });
    if (blocker) {
      toast({
        variant: 'destructive',
        title: 'Cannot publish yet',
        description: blocker,
      });
      return;
    }
    setConfirmOpen(true);
  };

  const runPublish = async () => {
    setConfirmOpen(false);
    if (!post?.id) {
      toast({ variant: 'destructive', title: 'Save a draft before publishing.' });
      return;
    }
    setPublishing(true);
    setPublishPhase(preparationHint || !looksLikeJpegUrl(mediaUrl) ? 'preparing' : 'publishing');
    try {
      const updateRes: any = await updatePost({
        postId: post.id,
        caption,
        mediaUrl: mediaUrl || '',
        mediaType,
        socialAccountId: instagram?.id || '',
      });
      if (updateRes?.error) {
        toast({ variant: 'destructive', title: 'Could not update draft', description: updateRes.error });
        return;
      }
      if (updateRes?.post) setPost(updateRes.post);

      setPublishPhase('publishing');
      const res: any = await publishPost(post.id);
      if (res?.error && res?.ok !== true) {
        if (res.post) setPost(res.post);
        toast({
          variant: 'destructive',
          title: res?.code === 'UNAUTHORIZED' ? 'Session expired' : 'Publish failed',
          description: res.error,
        });
        await bootstrap();
        return;
      }
      if (res?.post) setPost(res.post);
      toast({
        title: 'Published to Instagram',
        description: res?.post?.externalPermalink ? 'Open the permalink from Social Hub to view the post.' : 'Your Instagram post was published.',
      });
      router.navigate('/social' as any);
    } catch (e: any) {
      const status = e?.status || e?.response?.status || e?._httpStatus;
      const body = e?.data || e?.response?.data;
      toast({
        variant: 'destructive',
        title: status === 401 || status === 403 ? 'Session / auth error' : 'Publish failed',
        description: body?.error || e?.message || (status ? `Request failed (${status})` : 'Please try again.'),
      });
    } finally {
      setPublishing(false);
      setPublishPhase('');
    }
  };

  const reconnect = async () => {
    console.log('Instagram Auth Triggered');
    try {
      const res: any = await startOAuth('instagram', { forceReauth: true });
      if (res?.authorizationUrl) {
        await WebBrowser.openAuthSessionAsync(res.authorizationUrl, Linking.createURL('/social'));
        await refreshInstagram();
        return;
      }
      const error = {
        success: false,
        errorType: res?.errorType || res?.code || 'MISSING_AUTHORIZATION_URL',
        message: res?.error || res?.message || 'Could not start Instagram reconnect',
        stack: res?.stack || null,
        full: res,
      };
      console.error('--- INSTAGRAM DEBUG ERROR ---');
      console.error('Error Message:', error.message || error);
      console.error('Full Error Object:', JSON.stringify(error, null, 2));
      toast({ variant: 'destructive', title: 'Could not start Instagram reconnect', description: error.message });
    } catch (e: any) {
      console.error('--- INSTAGRAM DEBUG ERROR ---');
      console.error('Error Message:', e?.message || e);
      try {
        console.error('Full Error Object:', JSON.stringify(e, Object.getOwnPropertyNames(e || {}), 2));
      } catch {
        console.error('Full Error Object:', e);
      }
      toast({ variant: 'destructive', title: 'Reconnect failed', description: e?.message });
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton className="h-64 rounded-2xl" />
      </Screen>
    );
  }

  const captionOptions = [
    { value: 'day', label: 'Campaign day copy' },
    { value: 'custom', label: 'Custom' },
    ...generated.map((g) => ({ value: `gc:${g.id}`, label: `Generated: ${(g.content || '').slice(0, 40)}…` })),
  ];

  const confirmDescription = [
    `Account: @${instagram?.username || 'instagram'}`,
    `Caption: ${caption ? (caption.length > 240 ? `${caption.slice(0, 240)}…` : caption) : '(empty)'}`,
    `Media: ${mediaType} — ${mediaUrl ? 'selected' : 'none'}`,
    'This posts immediately. Scheduling is not available yet.',
  ].join('\n\n');

  return (
    <Screen>
      <View>
        <View className="flex-row items-center gap-2">
          <Icon as={Camera} size={16} className="text-primary" />
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instagram</Text>
        </View>
        <Text className="mt-1 font-heading-bold text-2xl tracking-tight">Create Instagram Post</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Save drafts anytime. JPEG and Instagram publish rules apply only when you publish.</Text>
      </View>

      {!instagram ? (
        <InfoBox>
          <Text className="text-sm">
            Instagram is not connected yet — you can still save a draft.{' '}
            <Link href="/social" className="text-primary underline">
              Connect in Social Hub
            </Link>{' '}
            before publishing.
          </Text>
        </InfoBox>
      ) : instagram.needsPublishReauth || instagram.canPublish === false ? (
        <View className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <Text className="text-sm font-semibold">Reconnect required for publishing</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Instagram currently granted: {instagram.scopes || 'none'}. Reconnect via Facebook Login and approve instagram_content_publish plus Page permissions. Your Instagram Professional account must be linked to a Facebook Page.
          </Text>
          <Button className="mt-3 self-start rounded-full" size="sm" onPress={reconnect}>
            Reconnect Instagram
          </Button>
        </View>
      ) : (
        <Text className="text-sm text-muted-foreground">
          Publishing as <Text className="text-sm font-semibold">@{instagram.username || 'instagram'}</Text>
        </Text>
      )}

      <View className="gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
        <SectionTitle className="mb-0">Context</SectionTitle>
        <View className="flex-row flex-wrap gap-y-2">
          <ContextItem label="Campaign">{campaign?.name || campaign?.id || '—'}</ContextItem>
          <ContextItem label="Campaign day">{day ? `Day ${day.day_number || '—'} · ${day.content_type || day.platform || ''}` : '—'}</ContextItem>
          <ContextItem label="Release">{release?.title || '—'}</ContextItem>
          <ContextItem label="Status">
            {post ? <StatusBadge status={post.status} /> : <Text className="text-sm text-muted-foreground">New draft</Text>}
          </ContextItem>
        </View>
      </View>

      <View className="gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
        <View>
          <Label>Caption source</Label>
          <Select value={captionSource} onValueChange={onSelectCaptionSource} options={captionOptions} title="Caption source" className="rounded-full" />
        </View>
        <Textarea
          value={caption}
          onChangeText={(t) => {
            setCaption(t.slice(0, INSTAGRAM_CAPTION_MAX));
            setCaptionSource('custom');
          }}
          numberOfLines={8}
          className="min-h-40 rounded-xl"
          placeholder="Write your Instagram caption…"
        />
        <Text className="text-right text-xs text-muted-foreground">
          {caption.length}/{INSTAGRAM_CAPTION_MAX}
        </Text>
      </View>

      <View className="gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
        <SectionTitle className="mb-0">Media</SectionTitle>
        <Text className="text-xs text-muted-foreground">JPEG, PNG, and WebP artwork can be saved on a draft. Non-JPEG images are prepared automatically when you publish.</Text>

        {artworkOptions.length > 0 ? (
          <View className="flex-row flex-wrap gap-3">
            {artworkOptions.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => onSelectArtwork(opt.url)}
                className={cn('w-[47%] rounded-xl border p-2', mediaUrl === opt.url ? 'border-primary bg-primary/5' : 'border-border/60')}>
                <ArtworkImage src={opt.url} className="aspect-square w-full" rounded="rounded-lg" />
                <Text className="mt-2 text-xs font-semibold">{opt.label}</Text>
                <Text className="text-[10px] text-muted-foreground">
                  {looksLikeJpegUrl(opt.url)
                    ? 'JPEG — ready for Instagram'
                    : looksLikePngOrWebpUrl(opt.url)
                      ? 'PNG/WebP — auto-prepared as JPEG on publish'
                      : 'Will be checked and prepared on publish'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted-foreground">No release/song artwork found. You can still save a draft.</Text>
        )}

        {preparationHint ? (
          <View className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <Text className="text-sm text-muted-foreground">{preparationHint}</Text>
          </View>
        ) : null}

        <View className="rounded-xl border border-border/50 bg-muted/30 p-3">
          <Text className="text-sm font-semibold">Linked video project</Text>
          {!video ? <Text className="mt-1 text-sm text-muted-foreground">No video linked to this day.</Text> : null}
          {video && !videoReady ? (
            <Text className="mt-1 text-sm text-muted-foreground">Video rendering is not available yet (preview only). Drafts can still use artwork images.</Text>
          ) : null}
          {videoReady ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 self-start rounded-full"
              onPress={() => {
                setMediaUrl(video.render_output_url);
                setMediaType('REELS');
              }}>
              Use rendered video
            </Button>
          ) : null}
        </View>
      </View>

      {publishBlocker ? (
        <InfoBox>
          <Text className="text-sm font-semibold">Before publishing</Text>
          <Text className="mt-1 text-sm text-muted-foreground">{publishBlocker}</Text>
        </InfoBox>
      ) : null}

      {post?.status === POST_STATUS.FAILED ? (
        <View className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <Text className="text-sm font-semibold">Last publish failed</Text>
          <Text className="mt-1 text-sm">{post.errorMessage || 'Instagram publishing failed. Try again.'}</Text>
          {post.errorCode ? <Text className="mt-1 text-xs text-muted-foreground">Code: {post.errorCode}</Text> : null}
        </View>
      ) : null}

      {post?.status === POST_STATUS.PUBLISHED ? (
        <View className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <Text className="text-sm font-semibold">Already published</Text>
          {post.externalPermalink ? (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(post.externalPermalink)}>
              <Text className="mt-1 text-sm text-primary underline">View on Instagram</Text>
            </Pressable>
          ) : (
            <Text className="mt-1 text-sm text-muted-foreground">Post ID: {post.externalPostId}</Text>
          )}
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <Button className="rounded-full" loading={saving} onPress={saveDraft}>
          Save Draft
        </Button>
        <Button
          className="rounded-full"
          loading={publishing}
          disabled={post?.status === POST_STATUS.PUBLISHED || post?.status === POST_STATUS.PUBLISHING}
          onPress={requestPublish}>
          {!publishing ? <Icon as={Send} size={14} className="text-primary-foreground" /> : null}
          <Text className="text-sm font-medium text-primary-foreground">
            {publishing
              ? publishPhase === 'preparing'
                ? 'Preparing image…'
                : 'Publishing to Instagram…'
              : post?.status === POST_STATUS.FAILED
                ? 'Retry Publish'
                : 'Publish to Instagram'}
          </Text>
        </Button>
      </View>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Publish to Instagram now?"
        description={confirmDescription}
        confirmLabel="Publish now"
        onConfirm={runPublish}
      />
    </Screen>
  );
}
