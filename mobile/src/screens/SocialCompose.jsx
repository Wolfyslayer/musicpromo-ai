import { useState } from "react";
import { Linking as RNLinking, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, Send } from "lucide-react-native";
import { db } from "@/api/db";
import { createPost, updatePost, loadPost, publishPost, getConnectionStatus, startOAuth, POST_STATUS } from "@/services/socialService";
import {
  INSTAGRAM_CAPTION_MAX,
  looksLikeJpegUrl,
  looksLikePngOrWebpUrl,
  getInstagramPublishBlocker,
  getMediaPreparationHint,
  validateDraftFields,
} from "@/services/social/publishValidation";
import { cn } from "@/lib/utils";
import { Screen, LoadingState } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import StatusBadge from "@/components/StatusBadge";
import ArtworkImage from "@/components/ArtworkImage";

const first = (v) => (Array.isArray(v) ? v[0] : v) || "";

async function loadComposer({ postIdParam, dayId, campaignIdParam, releaseIdParam }) {
  const ctx = {
    instagram: null,
    post: null,
    day: null,
    campaign: null,
    release: null,
    song: null,
    generated: [],
    video: null,
  };
  try {
    const status = await getConnectionStatus();
    ctx.instagram = (status?.connections || []).find((c) => c.provider === "instagram" && c.status === "connected") || null;

    if (postIdParam) {
      const res = await loadPost(postIdParam);
      if (res?.post) ctx.post = res.post;
    }
    if (dayId) ctx.day = await db.entities.CampaignDay.get(dayId);
    const campaignId = campaignIdParam || ctx.day?.campaign_id;
    if (campaignId) ctx.campaign = await db.entities.Campaign.get(campaignId);
    const releaseId = releaseIdParam || ctx.campaign?.release_id;
    if (releaseId) ctx.release = await db.entities.Release.get(releaseId).catch(() => null);
    if (ctx.campaign?.song_id) ctx.song = await db.entities.Song.get(ctx.campaign.song_id).catch(() => null);
    if (campaignId) {
      const content = await db.entities.GeneratedContent.filter({ campaign_id: campaignId }, "-created_date", 50).catch(() => []);
      ctx.generated = (content || []).filter((c) => c.type === "caption" || !c.type);
    }
    if (ctx.day?.video_project_id) {
      ctx.video = await db.entities.VideoProject.get(ctx.day.video_project_id).catch(() => null);
    }
  } catch (e) {
    toast({ variant: "destructive", title: "Could not load composer", description: e?.message || "Please try again." });
  }
  return ctx;
}

const dayCaption = (day) => [day?.caption, day?.hashtags, day?.cta].filter(Boolean).join("\n\n").slice(0, INSTAGRAM_CAPTION_MAX);

/**
 * Compose / publish Instagram SocialPost from campaign day context.
 * Save Draft uses minimal validation; Publish uses Instagram media rules.
 */
export default function SocialCompose() {
  const params = useLocalSearchParams();
  const ids = {
    dayId: first(params.day),
    campaignIdParam: first(params.campaign),
    releaseIdParam: first(params.release),
    postIdParam: first(params.post),
  };
  const query = useQuery({
    queryKey: ["social-compose", ids.postIdParam, ids.dayId, ids.campaignIdParam, ids.releaseIdParam],
    queryFn: () => loadComposer(ids),
  });

  if (query.isLoading || !query.data) return <LoadingState />;

  return <ComposeForm key={query.dataUpdatedAt} ctx={query.data} ids={ids} reload={() => query.refetch()} />;
}

function ComposeForm({ ctx, ids, reload }) {
  const { instagram, day, campaign, release, song, generated, video } = ctx;
  const { dayId, campaignIdParam, releaseIdParam, postIdParam } = ids;

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [post, setPost] = useState(ctx.post);
  const [caption, setCaption] = useState(() => (ctx.post ? ctx.post.caption || "" : postIdParam ? "" : dayCaption(day)));
  const [captionSource, setCaptionSource] = useState("day");
  const [mediaUrl, setMediaUrl] = useState(() =>
    ctx.post ? ctx.post.mediaUrl || "" : postIdParam ? "" : release?.artwork_url || song?.artwork_url || ""
  );
  const [mediaType, setMediaType] = useState(() => (ctx.post ? ctx.post.mediaType || "IMAGE" : "IMAGE"));

  const artworkOptions = [];
  if (release?.artwork_url) artworkOptions.push({ id: "release", label: "Release artwork", url: release.artwork_url });
  if (song?.artwork_url && song.artwork_url !== release?.artwork_url) {
    artworkOptions.push({ id: "song", label: "Song artwork", url: song.artwork_url });
  }

  const videoReady =
    video && video.rendering_status === "complete" && video.render_output_url && /^https:\/\//i.test(video.render_output_url);

  const publishBlocker = getInstagramPublishBlocker({ instagram, post, mediaUrl, mediaType, videoReady: Boolean(videoReady) });
  const preparationHint = getMediaPreparationHint(mediaUrl, mediaType);

  const captionOptions = [
    { value: "day", label: "Campaign day copy" },
    { value: "custom", label: "Custom" },
    ...generated.map((g) => ({ value: `gc:${g.id}`, label: `Generated: ${(g.content || "").slice(0, 40)}…` })),
  ];

  const onSelectCaptionSource = (value) => {
    setCaptionSource(value);
    if (value === "day" && day) {
      setCaption(dayCaption(day));
    } else if (value.startsWith("gc:")) {
      const item = generated.find((g) => g.id === value.slice(3));
      if (item?.content) setCaption(String(item.content).slice(0, INSTAGRAM_CAPTION_MAX));
    }
  };

  const onSelectArtwork = (url) => {
    setMediaUrl(url);
    setMediaType("IMAGE");
  };

  const saveDraft = async () => {
    const draftCheck = validateDraftFields({ caption });
    if (!draftCheck.ok) {
      toast({ variant: "destructive", title: "Could not save draft", description: draftCheck.message });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        provider: "instagram",
        socialAccountId: instagram?.id || "",
        campaignId: campaign?.id || campaignIdParam || "",
        campaignDayId: day?.id || dayId || "",
        releaseId: release?.id || releaseIdParam || "",
        caption,
        mediaUrl: mediaUrl || "",
        mediaType,
        videoProjectId: video?.id || day?.video_project_id || "",
        generatedContentId: captionSource.startsWith("gc:") ? captionSource.slice(3) : "",
        contentType: day?.content_type || "",
      };
      const res = post?.id ? await updatePost({ postId: post.id, ...payload }) : await createPost(payload);
      if (res?.error) {
        toast({ variant: "destructive", title: "Could not save draft", description: res.error });
        return;
      }
      setPost(res.post);
      toast({ title: "Draft saved", description: "You can keep editing. Publish when media and Instagram are ready." });
      if (res.post?.id && !postIdParam) {
        router.replace(`/social/compose?post=${res.post.id}`);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save draft", description: e?.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const requestPublish = () => {
    if (publishBlocker) {
      toast({ variant: "destructive", title: "Cannot publish yet", description: publishBlocker });
      return;
    }
    setConfirmOpen(true);
  };

  const runPublish = async () => {
    setConfirmOpen(false);
    if (!post?.id) {
      toast({ variant: "destructive", title: "Save a draft before publishing." });
      return;
    }
    setPublishing(true);
    setPublishPhase(preparationHint || !looksLikeJpegUrl(mediaUrl) ? "preparing" : "publishing");
    try {
      const updateRes = await updatePost({
        postId: post.id,
        caption,
        mediaUrl: mediaUrl || "",
        mediaType,
        socialAccountId: instagram?.id || "",
      });
      if (updateRes?.error) {
        toast({ variant: "destructive", title: "Could not update draft", description: updateRes.error });
        return;
      }
      if (updateRes?.post) setPost(updateRes.post);

      setPublishPhase("publishing");
      const res = await publishPost(post.id);
      if (res?.error && res?.ok !== true) {
        if (res.post) setPost(res.post);
        toast({
          variant: "destructive",
          title: res?.code === "UNAUTHORIZED" ? "Session expired" : "Publish failed",
          description: res.error,
        });
        reload();
        return;
      }
      if (res?.post) setPost(res.post);
      toast({
        title: "Published to Instagram",
        description: res?.post?.externalPermalink
          ? "Open the permalink from Social Hub to view the post."
          : "Your Instagram post was published.",
      });
      router.replace("/social");
    } catch (e) {
      const status = e?.status || e?.response?.status || e?._httpStatus;
      const body = e?.data || e?.response?.data;
      toast({
        variant: "destructive",
        title: status === 401 || status === 403 ? "Session / auth error" : "Publish failed",
        description: body?.error || e?.message || (status ? `Request failed (${status})` : "Please try again."),
      });
    } finally {
      setPublishing(false);
      setPublishPhase("");
    }
  };

  const reconnect = async () => {
    try {
      const res = await startOAuth("instagram", { forceReauth: true });
      if (res?.authorizationUrl) {
        await WebBrowser.openAuthSessionAsync(res.authorizationUrl, Linking.createURL("/social"));
        reload();
        return;
      }
      const message = res?.error || res?.message || "Could not start Instagram reconnect";
      console.error("--- INSTAGRAM DEBUG ERROR ---", JSON.stringify(res));
      toast({ variant: "destructive", title: "Could not start Instagram reconnect", description: message });
    } catch (e) {
      console.error("--- INSTAGRAM DEBUG ERROR ---", e?.message || e);
      toast({ variant: "destructive", title: "Reconnect failed", description: e?.message });
    }
  };

  const openPermalink = (url) => WebBrowser.openBrowserAsync(url).catch(() => RNLinking.openURL(url));

  return (
    <Screen contentClassName="gap-6">
      <Pressable onPress={() => router.navigate("/social")} className="flex-row items-center gap-1.5 self-start">
        <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
        <Text className="text-sm text-muted-foreground">Social Hub</Text>
      </Pressable>

      <View>
        <View className="flex-row items-center gap-2">
          <Icon as={Camera} size={16} className="text-primary" />
          <Text className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Instagram</Text>
        </View>
        <Text className="mt-1 font-heading text-2xl tracking-tight">Create Instagram Post</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Save drafts anytime. JPEG and Instagram publish rules apply only when you publish.
        </Text>
      </View>

      {!instagram ? (
        <View className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <Text className="text-sm">
            Instagram is not connected yet — you can still save a draft.{" "}
            <Text className="text-sm text-primary underline" onPress={() => router.navigate("/social")}>
              Connect in Social Hub
            </Text>{" "}
            before publishing.
          </Text>
        </View>
      ) : instagram.needsPublishReauth || instagram.canPublish === false ? (
        <View className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <Text className="text-sm font-600">Reconnect required for publishing</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Instagram currently granted: <Text className="font-mono text-xs text-muted-foreground">{instagram.scopes || "none"}</Text>.
            Reconnect via Facebook Login and approve{" "}
            <Text className="font-mono text-xs text-muted-foreground">instagram_content_publish</Text> plus Page permissions.
            Your Instagram Professional account must be linked to a Facebook Page.
          </Text>
          <Button className="mt-3 self-start rounded-full" size="sm" onPress={reconnect}>
            Reconnect Instagram
          </Button>
        </View>
      ) : (
        <Text className="text-sm text-muted-foreground">
          Publishing as <Text className="text-sm font-600">@{instagram.username || "instagram"}</Text>
        </Text>
      )}

      <View className="gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <Text className="font-heading text-sm uppercase tracking-wider text-muted-foreground">Context</Text>
        <View className="flex-row flex-wrap gap-3">
          <ContextItem label="Campaign" value={campaign?.name || campaign?.id || "—"} />
          <ContextItem
            label="Campaign day"
            value={day ? `Day ${day.day_number || "—"} · ${day.content_type || day.platform || ""}` : "—"}
          />
          <ContextItem label="Release" value={release?.title || "—"} />
          <View className="w-[47%]">
            <Text className="text-xs text-muted-foreground">Status</Text>
            {post ? <StatusBadge status={post.status} /> : <Text className="text-sm text-muted-foreground">New draft</Text>}
          </View>
        </View>
      </View>

      <View className="gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <View className="flex-row items-end justify-between gap-2">
          <View className="flex-1 gap-1">
            <Label>Caption source</Label>
            <Select
              value={captionSource}
              onValueChange={onSelectCaptionSource}
              options={captionOptions}
              title="Caption source"
              className="rounded-full"
            />
          </View>
          <Text className="text-xs text-muted-foreground">
            {caption.length}/{INSTAGRAM_CAPTION_MAX}
          </Text>
        </View>
        <Textarea
          value={caption}
          onChangeText={(text) => {
            setCaption(text.slice(0, INSTAGRAM_CAPTION_MAX));
            setCaptionSource("custom");
          }}
          className="min-h-40 rounded-xl"
          placeholder="Write your Instagram caption…"
        />
      </View>

      <View className="gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <Text className="font-heading text-sm uppercase tracking-wider text-muted-foreground">Media</Text>
        <Text className="text-xs text-muted-foreground">
          JPEG, PNG, and WebP artwork can be saved on a draft. Non-JPEG images are prepared automatically when you publish.
        </Text>

        {artworkOptions.length > 0 ? (
          <View className="flex-row flex-wrap gap-3">
            {artworkOptions.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => onSelectArtwork(opt.url)}
                className={cn(
                  "w-[47%] rounded-xl border p-2",
                  mediaUrl === opt.url ? "border-primary bg-primary/5" : "border-border/60"
                )}
              >
                <ArtworkImage src={opt.url} className="aspect-square w-full" rounded="rounded-lg" />
                <Text className="mt-2 text-xs font-600">{opt.label}</Text>
                <Text className="text-[10px] text-muted-foreground">
                  {looksLikeJpegUrl(opt.url)
                    ? "JPEG — ready for Instagram"
                    : looksLikePngOrWebpUrl(opt.url)
                      ? "PNG/WebP — auto-prepared as JPEG on publish"
                      : "Will be checked and prepared on publish"}
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
          <Text className="text-sm font-600">Linked video project</Text>
          {!video ? <Text className="mt-1 text-sm text-muted-foreground">No video linked to this day.</Text> : null}
          {video && !videoReady ? (
            <Text className="mt-1 text-sm text-muted-foreground">
              Video rendering is not available yet (preview only). Drafts can still use artwork images.
            </Text>
          ) : null}
          {videoReady ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 self-start rounded-full"
              onPress={() => {
                setMediaUrl(video.render_output_url);
                setMediaType("REELS");
              }}
            >
              Use rendered video
            </Button>
          ) : null}
        </View>
      </View>

      {publishBlocker ? (
        <View className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <Text className="text-sm font-600">Before publishing</Text>
          <Text className="mt-1 text-sm text-muted-foreground">{publishBlocker}</Text>
        </View>
      ) : null}

      {post?.status === POST_STATUS.FAILED ? (
        <View className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <Text className="text-sm font-600">Last publish failed</Text>
          <Text className="mt-1 text-sm">{post.errorMessage || "Instagram publishing failed. Try again."}</Text>
          {post.errorCode ? <Text className="mt-1 text-xs text-muted-foreground">Code: {post.errorCode}</Text> : null}
        </View>
      ) : null}

      {post?.status === POST_STATUS.PUBLISHED ? (
        <View className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <Text className="text-sm font-600">Already published</Text>
          {post.externalPermalink ? (
            <Text className="mt-1 text-sm text-primary underline" onPress={() => openPermalink(post.externalPermalink)}>
              View on Instagram
            </Text>
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
          icon={Send}
          loading={publishing}
          disabled={post?.status === POST_STATUS.PUBLISHED || post?.status === POST_STATUS.PUBLISHING}
          onPress={requestPublish}
        >
          {publishing
            ? publishPhase === "preparing"
              ? "Preparing image…"
              : "Publishing to Instagram…"
            : post?.status === POST_STATUS.FAILED
              ? "Retry Publish"
              : "Publish to Instagram"}
        </Button>
      </View>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Publish to Instagram now?"
        description={
          <>
            <Text className="text-sm font-700 text-muted-foreground">Account: </Text>@{instagram?.username || "instagram"}
            {"\n"}
            <Text className="text-sm font-700 text-muted-foreground">Caption: </Text>
            {caption.length > 280 ? `${caption.slice(0, 280)}…` : caption || "(empty)"}
            {"\n"}
            <Text className="text-sm font-700 text-muted-foreground">Media: </Text>
            {mediaType} — {mediaUrl ? "selected" : "none"}
            {"\n\n"}
            This posts immediately. Scheduling is not available yet.
          </>
        }
        confirmLabel="Publish now"
        onConfirm={runPublish}
      />
    </Screen>
  );
}

function ContextItem({ label, value }) {
  return (
    <View className="w-[47%]">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm font-600">{value}</Text>
    </View>
  );
}
