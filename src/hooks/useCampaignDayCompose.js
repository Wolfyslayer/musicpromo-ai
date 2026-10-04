import { useCallback, useEffect, useMemo, useState } from "react";

function postsFingerprint(posts) {
  if (!posts?.length) return "";
  return posts.map((p) => `${p.id}:${p.status}`).join("|");
}
import { db } from "@/api/base44Client";
import {
  createPost,
  updatePost,
  loadPost,
  publishPost,
  getConnectionStatus,
  startOAuth,
  POST_STATUS,
} from "@/services/socialService";
import {
  INSTAGRAM_CAPTION_MAX,
  looksLikeJpegUrl,
  getMediaPreparationHint,
  getPublishBlockerForProvider,
  validateDraftFields,
} from "@/services/social/publishValidation";
import { primaryProviderForDayPlatform } from "@/services/social/dayPlatform";

/**
 * Load and mutate SocialPost draft state for a campaign day (compose drawer / inline panel).
 */
export function useCampaignDayCompose({ day, campaign, release, existingPosts = [], enabled = true }) {
  const postsKey = postsFingerprint(existingPosts);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState("");

  const [providerId, setProviderId] = useState("instagram");
  const [connection, setConnection] = useState(null);
  const [song, setSong] = useState(null);
  const [video, setVideo] = useState(null);
  const [post, setPost] = useState(null);
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("IMAGE");

  const videoReady =
    video &&
    video.rendering_status === "complete" &&
    video.render_output_url &&
    /^https:\/\//i.test(video.render_output_url);

  const preparationHint =
    providerId === "instagram" ? getMediaPreparationHint(mediaUrl, mediaType) : null;

  const publishBlocker = getPublishBlockerForProvider(providerId, {
    connection,
    post,
    mediaUrl,
    mediaType,
    videoReady: Boolean(videoReady),
  });

  const bootstrap = useCallback(async () => {
    if (!enabled || !day?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const status = await getConnectionStatus();
      const resolvedProvider = primaryProviderForDayPlatform(day.platform) || "instagram";
      setProviderId(resolvedProvider);

      let loadedPost = null;
      const draftFromList =
        existingPosts.find((p) => p.provider === resolvedProvider && p.status !== POST_STATUS.PUBLISHED) ||
        existingPosts[0];
      if (draftFromList?.id) {
        const res = await loadPost(draftFromList.id).catch(() => null);
        loadedPost = res?.post || draftFromList;
      }

      let songRow = null;
      if (campaign?.song_id) {
        songRow = await db.entities.Song.get(campaign.song_id).catch(() => null);
        setSong(songRow);
      }

      let vp = null;
      if (day.video_project_id) {
        vp = await db.entities.VideoProject.get(day.video_project_id).catch(() => null);
        setVideo(vp);
      }

      const conn =
        (status?.connections || []).find(
          (c) => c.provider === resolvedProvider && c.status === "connected"
        ) || null;
      setConnection(conn);

      const vpReady =
        vp && vp.rendering_status === "complete" && vp.render_output_url && /^https:\/\//i.test(vp.render_output_url);

      if (loadedPost) {
        setPost(loadedPost);
        setCaption((loadedPost.caption || "").slice(0, INSTAGRAM_CAPTION_MAX));
        setMediaUrl(loadedPost.mediaUrl || loadedPost.media_url || "");
        setMediaType(loadedPost.mediaType || loadedPost.media_type || "IMAGE");
        if (loadedPost.provider) setProviderId(String(loadedPost.provider).toLowerCase());
      } else {
        const parts = [day.caption, day.hashtags, day.cta].filter(Boolean);
        setPost(null);
        setCaption(parts.join("\n\n").slice(0, INSTAGRAM_CAPTION_MAX));
        if ((resolvedProvider === "tiktok" || resolvedProvider === "youtube") && vpReady) {
          setMediaUrl(String(vp.render_output_url));
          setMediaType("REELS");
        } else {
          const art = release?.artwork_url || songRow?.artwork_url || "";
          setMediaUrl(art);
          setMediaType("IMAGE");
        }
      }
    } catch {
      /* caller may toast */
    } finally {
      setLoading(false);
    }
  }, [campaign?.song_id, day, enabled, postsKey, release?.artwork_url]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const saveDraft = useCallback(async () => {
    const draftCheck = validateDraftFields({ caption });
    if (!draftCheck.ok) {
      return { ok: false, error: draftCheck.message };
    }
    setSaving(true);
    try {
      const payload = {
        provider: providerId,
        socialAccountId: connection?.id || "",
        campaignId: campaign?.id || "",
        campaignDayId: day?.id || "",
        releaseId: release?.id || campaign?.release_id || "",
        caption,
        mediaUrl: mediaUrl || "",
        mediaType,
        videoProjectId: video?.id || day?.video_project_id || "",
        contentType: day?.content_type || "",
      };
      let res;
      if (post?.id) {
        res = await updatePost({ postId: post.id, ...payload });
      } else {
        res = await createPost(payload);
      }
      if (res?.error) return { ok: false, error: res.error };
      setPost(res.post);
      return { ok: true, post: res.post };
    } catch (e) {
      return { ok: false, error: e?.message || "Could not save draft" };
    } finally {
      setSaving(false);
    }
  }, [
    campaign?.id,
    campaign?.release_id,
    caption,
    connection?.id,
    day?.content_type,
    day?.id,
    day?.video_project_id,
    mediaType,
    mediaUrl,
    post?.id,
    providerId,
    release?.id,
    video?.id,
  ]);

  const runPublish = useCallback(async () => {
    let effectiveId = post?.id;
    if (!effectiveId) {
      const saved = await saveDraft();
      if (!saved.ok) return saved;
      effectiveId = saved.post?.id;
      if (saved.post) setPost(saved.post);
    }
    if (!effectiveId) return { ok: false, error: "Save a draft before publishing." };

    setPublishing(true);
    setPublishPhase(preparationHint || !looksLikeJpegUrl(mediaUrl) ? "preparing" : "publishing");
    try {
      const updateRes = await updatePost({
        postId: effectiveId,
        caption,
        mediaUrl: mediaUrl || "",
        mediaType,
        socialAccountId: connection?.id || "",
      });
      if (updateRes?.error) return { ok: false, error: updateRes.error };
      if (updateRes?.post) setPost(updateRes.post);

      setPublishPhase("publishing");
      const res = await publishPost(effectiveId);
      if (res?.error && res?.ok !== true) {
        if (res.post) setPost(res.post);
        return { ok: false, error: res.error, post: res.post };
      }
      if (res?.post) setPost(res.post);
      return { ok: true, post: res.post };
    } catch (e) {
      return { ok: false, error: e?.message || "Publish failed" };
    } finally {
      setPublishing(false);
      setPublishPhase("");
    }
  }, [caption, connection?.id, mediaType, mediaUrl, post, preparationHint, saveDraft]);

  const reconnect = useCallback(async () => {
    const res = await startOAuth(providerId, { forceReauth: true });
    if (res?.authorizationUrl) {
      window.location.assign(res.authorizationUrl);
      return { ok: true };
    }
    return { ok: false, error: res?.error || res?.message || "Could not start reconnect" };
  }, [providerId]);

  const useRenderedVideo = useCallback(() => {
    if (videoReady) {
      setMediaUrl(video.render_output_url);
      setMediaType("REELS");
    }
  }, [video, videoReady]);

  const artworkUrl = useMemo(
    () => release?.artwork_url || song?.artwork_url || "",
    [release?.artwork_url, song?.artwork_url]
  );

  return {
    loading,
    saving,
    publishing,
    publishPhase,
    providerId,
    connection,
    post,
    caption,
    setCaption,
    mediaUrl,
    mediaType,
    video,
    videoReady,
    preparationHint,
    publishBlocker,
    artworkUrl,
    bootstrap,
    saveDraft,
    runPublish,
    reconnect,
    useRenderedVideo,
  };
}
