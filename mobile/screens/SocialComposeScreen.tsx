import { db } from '@/api/db';
import * as DocumentPicker from 'expo-document-picker';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Camera, Loader2, Send } from 'lucide-react-native';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ArtworkImage } from '@/components/ArtworkImage';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/lib/toast';
import {
  createPost,
  updatePost,
  loadPost,
  publishPost,
  getConnectionStatus,
  startOAuth,
  POST_STATUS,
} from '@/services/socialService';
import {
  INSTAGRAM_CAPTION_MAX,
  looksLikeJpegUrl,
  looksLikePngOrWebpUrl,
  getInstagramPublishBlocker,
  getMediaPreparationHint,
  validateDraftFields,
} from '@/services/social/publishValidation';

export default function SocialComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    day?: string;
    campaign?: string;
    release?: string;
    post?: string;
  }>();
  const { toast } = useToast();

  const dayId = params.day || '';
  const campaignIdParam = params.campaign || '';
  const releaseIdParam = params.release || '';
  const postIdParam = params.post || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [instagram, setInstagram] = useState<Record<string, unknown> | null>(null);
  const [day, setDay] = useState<Record<string, unknown> | null>(null);
  const [campaign, setCampaign] = useState<Record<string, unknown> | null>(null);
  const [release, setRelease] = useState<Record<string, unknown> | null>(null);
  const [song, setSong] = useState<Record<string, unknown> | null>(null);
  const [generated, setGenerated] = useState<Array<Record<string, unknown>>>([]);
  const [video, setVideo] = useState<Record<string, unknown> | null>(null);

  const [post, setPost] = useState<Record<string, unknown> | null>(null);
  const [caption, setCaption] = useState('');
  const [captionSource, setCaptionSource] = useState('day');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('IMAGE');

  const artworkOptions = useMemo(() => {
    const opts: Array<{ id: string; label: string; url: string }> = [];
    if (release?.artwork_url) {
      opts.push({ id: 'release', label: 'Release artwork', url: String(release.artwork_url) });
    }
    if (song?.artwork_url && song.artwork_url !== release?.artwork_url) {
      opts.push({ id: 'song', label: 'Song artwork', url: String(song.artwork_url) });
    }
    return opts;
  }, [release, song]);

  const videoReady =
    video &&
    video.rendering_status === 'complete' &&
    video.render_output_url &&
    /^https:\/\//i.test(String(video.render_output_url));

  const publishBlocker = (getInstagramPublishBlocker as (args: Record<string, unknown>) => string | null)({
    instagram,
    post,
    mediaUrl,
    mediaType,
    videoReady: Boolean(videoReady),
  });
  const preparationHint = getMediaPreparationHint(mediaUrl, mediaType);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getConnectionStatus();
      const ig = (status?.connections || []).find(
        (c: { provider?: string; status?: string }) => c.provider === 'instagram' && c.status === 'connected',
      );
      setInstagram(ig || null);

      if (postIdParam) {
        const res = await loadPost(postIdParam);
        const p = res?.post;
        if (p) {
          setPost(p);
          setCaption(String(p.caption || ''));
          setMediaUrl(String(p.mediaUrl || ''));
          setMediaType(String(p.mediaType || 'IMAGE'));
        }
      }

      let dayRow: Record<string, unknown> | null = null;
      let campaignRow: Record<string, unknown> | null = null;
      let releaseRow: Record<string, unknown> | null = null;
      let songRow: Record<string, unknown> | null = null;

      if (dayId) {
        dayRow = (await db.entities.CampaignDay.get(dayId)) as Record<string, unknown>;
        setDay(dayRow);
      }
      const campaignId = campaignIdParam || String(dayRow?.campaign_id || '');
      if (campaignId) {
        campaignRow = (await db.entities.Campaign.get(campaignId)) as Record<string, unknown>;
        setCampaign(campaignRow);
      }
      const releaseId = releaseIdParam || String(campaignRow?.release_id || '');
      if (releaseId) {
        releaseRow = ((await db.entities.Release.get(releaseId).catch(() => null)) as Record<string, unknown>) || null;
        setRelease(releaseRow);
      }
      if (campaignRow?.song_id) {
        songRow = ((await db.entities.Song.get(String(campaignRow.song_id)).catch(() => null)) as Record<
          string,
          unknown
        >) || null;
        setSong(songRow);
      }

      if (campaignId) {
        const content = await db.entities.GeneratedContent.filter({ campaign_id: campaignId }, '-created_date', 50).catch(
          () => [],
        );
        setGenerated((content || []).filter((c: { type?: string }) => c.type === 'caption' || !c.type));
      }

      if (dayRow?.video_project_id) {
        const vp = await db.entities.VideoProject.get(String(dayRow.video_project_id)).catch(() => null);
        setVideo(vp as Record<string, unknown>);
      }

      if (!postIdParam) {
        const parts = [dayRow?.caption, dayRow?.hashtags, dayRow?.cta].filter(Boolean).map(String);
        setCaption(parts.join('\n\n').slice(0, INSTAGRAM_CAPTION_MAX));
        setCaptionSource('day');
        const art = String(releaseRow?.artwork_url || songRow?.artwork_url || '');
        setMediaUrl(art);
        setMediaType('IMAGE');
      }
    } catch (e) {
      toast({
        title: 'Could not load composer',
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [campaignIdParam, dayId, postIdParam, releaseIdParam, toast]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const onSelectCaptionSource = (value: string) => {
    setCaptionSource(value);
    if (value === 'day' && day) {
      const parts = [day.caption, day.hashtags, day.cta].filter(Boolean).map(String);
      setCaption(parts.join('\n\n').slice(0, INSTAGRAM_CAPTION_MAX));
    } else if (value.startsWith('gc:')) {
      const id = value.slice(3);
      const item = generated.find((g) => g.id === id);
      if (item?.content) setCaption(String(item.content).slice(0, INSTAGRAM_CAPTION_MAX));
    }
  };

  const pickMediaFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setBusyUpload(asset);
    } catch (e) {
      toast({ title: 'Could not pick media', description: e instanceof Error ? e.message : undefined });
    }
  };

  const setBusyUpload = async (asset: { uri: string; mimeType?: string; name?: string }) => {
    try {
      const blob = await (await fetch(asset.uri)).blob();
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file: blob });
      setMediaUrl(file_url);
      setMediaType(asset.mimeType?.startsWith('video') ? 'REELS' : 'IMAGE');
      toast({ title: 'Media uploaded' });
    } catch (e) {
      toast({ title: 'Upload failed', description: e instanceof Error ? e.message : undefined });
    }
  };

  const saveDraft = async () => {
    const draftCheck = validateDraftFields({ caption });
    if (!draftCheck.ok) {
      toast({ title: 'Could not save draft', description: draftCheck.message });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        provider: 'instagram',
        socialAccountId: String(instagram?.id || ''),
        campaignId: String(campaign?.id || campaignIdParam || ''),
        campaignDayId: String(day?.id || dayId || ''),
        releaseId: String(release?.id || releaseIdParam || ''),
        caption,
        mediaUrl: mediaUrl || '',
        mediaType,
        videoProjectId: String(video?.id || day?.video_project_id || ''),
        generatedContentId: captionSource.startsWith('gc:') ? captionSource.slice(3) : '',
        contentType: String(day?.content_type || ''),
      };

      let res;
      if (post?.id) {
        res = await updatePost({ postId: String(post.id), ...payload });
      } else {
        res = await createPost(payload);
      }
      if (res?.error) {
        toast({ title: 'Could not save draft', description: res.error });
        return;
      }
      setPost(res.post);
      toast({ title: 'Draft saved', description: 'You can keep editing. Publish when media and Instagram are ready.' });
      if (res.post?.id && !postIdParam) {
        router.replace(`/social/compose?post=${res.post.id}` as never);
      }
    } catch (e) {
      toast({
        title: 'Could not save draft',
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const requestPublish = () => {
    const blocker = (getInstagramPublishBlocker as (args: Record<string, unknown>) => string | null)({
      instagram,
      post,
      mediaUrl,
      mediaType,
      videoReady: Boolean(videoReady),
    });
    if (blocker) {
      toast({ title: 'Cannot publish yet', description: blocker });
      return;
    }
    setConfirmOpen(true);
  };

  const runPublish = async () => {
    setConfirmOpen(false);
    if (!post?.id) {
      toast({ title: 'Save a draft before publishing.' });
      return;
    }
    setPublishing(true);
    setPublishPhase(preparationHint || !looksLikeJpegUrl(mediaUrl) ? 'preparing' : 'publishing');
    try {
      const updateRes = await updatePost({
        postId: String(post.id),
        caption,
        mediaUrl: mediaUrl || '',
        mediaType,
        socialAccountId: String(instagram?.id || ''),
      });
      if (updateRes?.error) {
        toast({ title: 'Could not update draft', description: updateRes.error });
        return;
      }
      if (updateRes?.post) setPost(updateRes.post);

      setPublishPhase('publishing');
      const res = await publishPost(String(post.id));
      if (res?.error && res?.ok !== true) {
        if (res.post) setPost(res.post);
        toast({
          title: res?.code === 'UNAUTHORIZED' ? 'Session expired' : 'Publish failed',
          description: res.error,
        });
        await bootstrap();
        return;
      }
      if (res?.post) setPost(res.post);
      toast({
        title: 'Published to Instagram',
        description: res?.post?.externalPermalink
          ? 'Open the permalink from Social Hub to view the post.'
          : 'Your Instagram post was published.',
      });
      router.push('/social');
    } catch (e) {
      toast({
        title: 'Publish failed',
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setPublishing(false);
      setPublishPhase('');
    }
  };

  const reconnect = async () => {
    try {
      const res = await startOAuth('instagram', { forceReauth: true });
      if (res?.authorizationUrl) {
        await WebBrowser.openBrowserAsync(res.authorizationUrl);
        return;
      }
      toast({
        title: 'Could not start Instagram reconnect',
        description: res?.error || res?.message || 'Could not start Instagram reconnect',
      });
    } catch (e) {
      toast({ title: 'Reconnect failed', description: e instanceof Error ? e.message : undefined });
    }
  };

  if (loading) return <ActivityIndicator className="flex-1 py-24" />;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4">
      <Pressable onPress={() => router.push('/social')} className="flex-row items-center gap-1.5">
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">Social Hub</Text>
      </Pressable>

      <View>
        <View className="flex-row items-center gap-2">
          <Camera color="#8b5cf6" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instagram</Text>
        </View>
        <Text className="mt-1 text-2xl font-bold text-foreground">Create Instagram Post</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Save drafts anytime. JPEG and Instagram publish rules apply only when you publish.
        </Text>
      </View>

      {!instagram ? (
        <View className="rounded-2xl border border-border bg-muted/20 p-4">
          <Text className="text-sm text-muted-foreground">
            Instagram is not connected yet — you can still save a draft.{' '}
            <Link href="/social">
              <Text className="text-primary">Connect in Social Hub</Text>
            </Link>{' '}
            before publishing.
          </Text>
        </View>
      ) : null}

      <View className="gap-3 rounded-2xl border border-border bg-card/50 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Context</Text>
        <Text className="text-xs text-muted-foreground">Campaign</Text>
        <Text className="font-semibold text-foreground">{String(campaign?.name || campaign?.id || '—')}</Text>
        <Text className="text-xs text-muted-foreground">Campaign day</Text>
        <Text className="font-semibold text-foreground">
          {day ? `Day ${day.day_number || '—'} · ${day.content_type || day.platform || ''}` : '—'}
        </Text>
        <Text className="text-xs text-muted-foreground">Release</Text>
        <Text className="font-semibold text-foreground">{String(release?.title || '—')}</Text>
        <Text className="text-xs text-muted-foreground">Status</Text>
        {post ? <StatusBadge status={String(post.status || 'draft')} /> : <Text className="text-muted-foreground">New draft</Text>}
      </View>

      <View className="gap-3 rounded-2xl border border-border bg-card/50 p-4">
        <Label>Caption source</Label>
        <Select value={captionSource} onValueChange={onSelectCaptionSource}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Campaign day copy</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
            {generated.map((g) => (
              <SelectItem key={String(g.id)} value={`gc:${g.id}`}>
                Generated: {String(g.content || '').slice(0, 40)}…
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Text className="text-xs text-muted-foreground">
          {caption.length}/{INSTAGRAM_CAPTION_MAX}
        </Text>
        <Textarea
          value={caption}
          onChangeText={(v) => {
            setCaption(v.slice(0, INSTAGRAM_CAPTION_MAX));
            setCaptionSource('custom');
          }}
          placeholder="Write your Instagram caption…"
        />
      </View>

      <View className="gap-3 rounded-2xl border border-border bg-card/50 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Media</Text>
        <Button variant="outline" label="Pick image or video from device" onPress={pickMediaFile} />
        {artworkOptions.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => {
              setMediaUrl(opt.url);
              setMediaType('IMAGE');
            }}
            className={`rounded-xl border p-2 ${mediaUrl === opt.url ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <ArtworkImage src={opt.url} className="aspect-square w-full" rounded="rounded-lg" />
            <Text className="mt-2 text-xs font-semibold text-foreground">{opt.label}</Text>
            <Text className="text-[10px] text-muted-foreground">
              {looksLikeJpegUrl(opt.url)
                ? 'JPEG — ready for Instagram'
                : looksLikePngOrWebpUrl(opt.url)
                  ? 'PNG/WebP — auto-prepared as JPEG on publish'
                  : 'Will be checked on publish'}
            </Text>
          </Pressable>
        ))}
        {preparationHint ? (
          <View className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <Text className="text-sm text-muted-foreground">{preparationHint}</Text>
          </View>
        ) : null}
        {videoReady ? (
          <Button
            variant="outline"
            label="Use rendered video"
            onPress={() => {
              setMediaUrl(String(video?.render_output_url));
              setMediaType('REELS');
            }}
          />
        ) : null}
      </View>

      {publishBlocker ? (
        <View className="rounded-2xl border border-border bg-muted/20 p-4">
          <Text className="font-semibold text-foreground">Before publishing</Text>
          <Text className="mt-1 text-sm text-muted-foreground">{publishBlocker}</Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <Button disabled={saving} onPress={saveDraft}>
          {saving ? <Loader2 color="#fff" size={14} /> : null}
          <Text className="ml-1 font-semibold text-white">Save Draft</Text>
        </Button>
        <Button
          disabled={publishing || post?.status === POST_STATUS.PUBLISHED || post?.status === POST_STATUS.PUBLISHING}
          onPress={requestPublish}
        >
          {publishing ? <Loader2 color="#fff" size={14} /> : <Send color="#fff" size={14} />}
          <Text className="ml-1 font-semibold text-white">
            {publishing
              ? publishPhase === 'preparing'
                ? 'Preparing image…'
                : 'Publishing…'
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
        description={`Account: @${String(instagram?.username || 'instagram')}\nMedia: ${mediaType}`}
        confirmLabel="Publish now"
        onConfirm={runPublish}
      />
    </ScrollView>
  );
}
