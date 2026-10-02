import { useCallback, useEffect, useMemo, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Artwork, Badge, Button, Card, ErrorText, Field, Muted, P, Screen, SelectField } from "@/components/ui";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";
import {
  getInstagramPublishBlocker,
  getMediaPreparationHint,
  INSTAGRAM_CAPTION_MAX,
  validateCaptionLength,
} from "@/lib/publishValidation";
import { createPost, getConnectionStatus, loadPost, publishPost, startOAuth, updatePost } from "@/lib/social";
import type { Row } from "@/lib/types";

export default function Compose() {
  const router = useRouter();
  const params = useLocalSearchParams<{ campaign?: string; day?: string; release?: string; post?: string }>();
  const { requireAuth } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [instagram, setInstagram] = useState<Row | null>(null);
  const [day, setDay] = useState<Row | null>(null);
  const [campaign, setCampaign] = useState<Row | null>(null);
  const [release, setRelease] = useState<Row | null>(null);
  const [song, setSong] = useState<Row | null>(null);
  const [generated, setGenerated] = useState<Row[]>([]);
  const [video, setVideo] = useState<Row | null>(null);
  const [post, setPost] = useState<Row | null>(null);
  const [caption, setCaption] = useState("");
  const [captionSource, setCaptionSource] = useState("day");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("IMAGE");

  const artworkOptions = useMemo(() => {
    const options: { id: string; label: string; url: string }[] = [];
    if (release?.artwork_url) options.push({ id: "release", label: "Release artwork", url: String(release.artwork_url) });
    if (song?.artwork_url && song.artwork_url !== release?.artwork_url) {
      options.push({ id: "song", label: "Song artwork", url: String(song.artwork_url) });
    }
    return options;
  }, [release, song]);

  const videoReady = Boolean(video?.rendering_status === "complete" && video?.render_output_url && /^https:\/\//i.test(String(video.render_output_url)));
  const publishBlocker = getInstagramPublishBlocker({
    instagram,
    post,
    mediaUrl,
    mediaType,
    videoReady,
  });
  const preparationHint = getMediaPreparationHint(mediaUrl, mediaType);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getConnectionStatus().catch(() => ({ data: { connections: [] as Row[] } }));
      const ig = (status.data?.connections || []).find((item: Row) => item.provider === "instagram" && item.status === "connected");
      setInstagram(ig || null);

      let loadedPost: Row | null = null;
      if (params.post) {
        const result = await loadPost(String(params.post));
        loadedPost = result.data?.post || null;
        if (loadedPost) {
          setPost(loadedPost);
          setCaption(loadedPost.caption || "");
          setMediaUrl(loadedPost.mediaUrl || loadedPost.media_url || "");
          setMediaType(loadedPost.mediaType || loadedPost.media_type || "IMAGE");
        }
      }

      const dayRow = params.day ? await db.entities.CampaignDay.get(String(params.day)).catch(() => null) : null;
      setDay(dayRow);
      const campaignId = params.campaign || dayRow?.campaign_id;
      const campaignRow = campaignId ? await db.entities.Campaign.get(String(campaignId)).catch(() => null) : null;
      setCampaign(campaignRow);
      const releaseId = params.release || campaignRow?.release_id;
      const releaseRow = releaseId ? await db.entities.Release.get(String(releaseId)).catch(() => null) : null;
      setRelease(releaseRow);
      const songRow = campaignRow?.song_id ? await db.entities.Song.get(String(campaignRow.song_id)).catch(() => null) : null;
      setSong(songRow);
      if (campaignId) {
        const content = await db.entities.GeneratedContent.filter({ campaign_id: campaignId }, "-created_date", 50).catch(() => []);
        setGenerated((content || []).filter((item) => item.type === "caption" || !item.type));
      }
      if (dayRow?.video_project_id) {
        setVideo(await db.entities.VideoProject.get(String(dayRow.video_project_id)).catch(() => null));
      }
      if (!loadedPost) {
        const tags = Array.isArray(dayRow?.hashtags) ? dayRow.hashtags.join(" ") : dayRow?.hashtags || "";
        const parts = [dayRow?.caption, tags, dayRow?.cta].filter(Boolean);
        setCaption(parts.join("\n\n").slice(0, INSTAGRAM_CAPTION_MAX));
        setCaptionSource("day");
        setMediaUrl(String(releaseRow?.artwork_url || songRow?.artwork_url || ""));
        setMediaType("IMAGE");
      }
    } catch (err) {
      toast({ title: "Could not load composer", description: errorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [params.campaign, params.day, params.post, params.release, toast]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const captionOptions = [
    { label: "Campaign day", value: "day" },
    { label: "Custom", value: "custom" },
    ...generated.map((item) => ({ label: String(item.title || "Generated caption"), value: `gc:${item.id}` })),
  ];

  const onSelectCaptionSource = (value: string) => {
    setCaptionSource(value);
    if (value === "day" && day) {
      const tags = Array.isArray(day.hashtags) ? day.hashtags.join(" ") : day.hashtags || "";
      setCaption([day.caption, tags, day.cta].filter(Boolean).join("\n\n").slice(0, INSTAGRAM_CAPTION_MAX));
    } else if (value.startsWith("gc:")) {
      const item = generated.find((entry) => entry.id === value.slice(3));
      if (item?.content) setCaption(String(item.content).slice(0, INSTAGRAM_CAPTION_MAX));
    }
  };

  const saveDraft = async () => {
    if (!requireAuth()) return;
    const draftCheck = validateCaptionLength(caption);
    if (!draftCheck.ok) {
      toast({ title: "Could not save draft", description: draftCheck.message, variant: "destructive" });
      return;
    }
    setBusy("save");
    try {
      const payload = {
        provider: "instagram",
        socialAccountId: instagram?.id || "",
        campaignId: campaign?.id || params.campaign || "",
        campaignDayId: day?.id || params.day || "",
        releaseId: release?.id || params.release || "",
        caption,
        mediaUrl: mediaUrl || "",
        mediaType,
        videoProjectId: video?.id || day?.video_project_id || "",
        generatedContentId: captionSource.startsWith("gc:") ? captionSource.slice(3) : "",
        contentType: day?.content_type || "",
      };
      const result = post?.id ? await updatePost({ postId: post.id, ...payload }) : await createPost(payload);
      if (result.data?.error) throw new Error(result.data.error);
      const saved = result.data?.post;
      if (saved) setPost(saved);
      toast({ title: "Draft saved" });
      if (saved?.id && !params.post) {
        router.replace({ pathname: "/social/compose", params: { post: saved.id } });
      }
    } catch (err) {
      toast({ title: "Could not save draft", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const runPublish = async () => {
    setConfirming(false);
    if (!post?.id) {
      toast({ title: "Save a draft before publishing.", variant: "destructive" });
      return;
    }
    setBusy("publish");
    try {
      const updateRes = await updatePost({
        postId: post.id,
        caption,
        mediaUrl: mediaUrl || "",
        mediaType,
        socialAccountId: instagram?.id || "",
      });
      if (updateRes.data?.error) throw new Error(updateRes.data.error);
      if (updateRes.data?.post) setPost(updateRes.data.post);
      const published = await publishPost(String(post.id));
      if (published.data?.error && published.data?.ok !== true) throw new Error(published.data.error);
      if (published.data?.post) setPost(published.data.post);
      toast({ title: "Published to Instagram" });
      router.replace("/social");
    } catch (err) {
      toast({ title: "Publish failed", description: errorMessage(err), variant: "destructive" });
      await bootstrap();
    } finally {
      setBusy("");
    }
  };

  const requestPublish = () => {
    if (!requireAuth()) return;
    if (publishBlocker) {
      toast({ title: "Cannot publish yet", description: publishBlocker, variant: "destructive" });
      return;
    }
    setConfirming(true);
  };

  const reconnect = async () => {
    if (!requireAuth()) return;
    try {
      const result = await startOAuth("instagram", { forceReauth: true });
      const url = result.data?.authorizationUrl || result.data?.url;
      if (!url) throw new Error(result.data?.error || "Could not start Instagram reconnect.");
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      toast({ title: "Reconnect failed", description: errorMessage(err), variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Screen>
        <Muted>Loading composer…</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-4">
        <P className="font-heading text-2xl">Create Instagram post</P>
        <Muted>Save drafts anytime. Instagram’s 2,200-character caption and media rules apply when you publish.</Muted>
        {!instagram ? (
          <Card>
            <Muted>Instagram is not connected yet. You can still save a draft. Connect it in Social Hub before publishing.</Muted>
          </Card>
        ) : instagram.needsPublishReauth || instagram.canPublish === false ? (
          <Card className="gap-2">
            <P className="font-semibold">Reconnect required for publishing</P>
            <Muted>Instagram currently granted: {instagram.scopes || "none"}.</Muted>
            <Button label="Reconnect Instagram" variant="outline" onPress={reconnect} />
          </Card>
        ) : (
          <Muted>Publishing as @{instagram.username || "instagram"}</Muted>
        )}
        <Card className="gap-2">
          <P className="font-semibold">Context</P>
          <Muted>Campaign {campaign?.name || "—"}</Muted>
          <Muted>Day {day ? `${day.day_number || "—"} · ${day.content_type || day.platform || ""}` : "—"}</Muted>
          <Muted>Release {release?.title || "—"}</Muted>
          {post ? <Badge status={post.status} /> : <Muted>New draft</Muted>}
        </Card>
        <SelectField label="Caption source" value={captionSource} options={captionOptions} onChange={onSelectCaptionSource} />
        <Field label={`Caption (${caption.length}/${INSTAGRAM_CAPTION_MAX})`} value={caption} onChangeText={setCaption} multiline autoCapitalize="sentences" />
        <P className="font-semibold">Media</P>
        <View className="flex-row flex-wrap gap-2">
          {artworkOptions.map((option) => (
            <Button
              key={option.id}
              label={option.label}
              variant={mediaUrl === option.url && mediaType === "IMAGE" ? "primary" : "outline"}
              onPress={() => {
                setMediaUrl(option.url);
                setMediaType("IMAGE");
              }}
            />
          ))}
          {videoReady ? (
            <Button
              label="Rendered video"
              variant={mediaType === "VIDEO" ? "primary" : "outline"}
              onPress={() => {
                setMediaUrl(String(video?.render_output_url || ""));
                setMediaType("VIDEO");
              }}
            />
          ) : null}
        </View>
        <Artwork uri={mediaType === "IMAGE" ? mediaUrl : undefined} />
        <Field label="Media URL" value={mediaUrl} onChangeText={setMediaUrl} placeholder="https://" />
        {preparationHint ? <Muted>{preparationHint}</Muted> : null}
        <ErrorText>{publishBlocker || ""}</ErrorText>
        <Button label="Save draft" variant="outline" loading={busy === "save"} onPress={saveDraft} />
        {confirming ? (
          <Card className="gap-2">
            <P className="font-semibold">Publish this post to Instagram?</P>
            <Button label="Confirm publish" loading={busy === "publish"} onPress={runPublish} />
            <Button label="Cancel" variant="outline" onPress={() => setConfirming(false)} />
          </Card>
        ) : (
          <Button label="Publish" loading={busy === "publish"} onPress={requestPublish} />
        )}
      </View>
    </Screen>
  );
}
