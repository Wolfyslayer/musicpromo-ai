import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Instagram, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import StatusBadge from "@/components/StatusBadge";
import ArtworkImage from "@/components/ArtworkImage";
import PageHeader from "@/components/PageHeader";

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
  looksLikePngOrWebpUrl,
  getInstagramPublishBlocker,
  getMediaPreparationHint,
  validateDraftFields,
} from "@/services/social/publishValidation";

/**
 * Compose / publish Instagram SocialPost from campaign day context.
 * Save Draft uses minimal validation; Publish uses Instagram media rules.
 */
export default function SocialCompose() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();

  const dayId = params.get("day") || "";
  const campaignIdParam = params.get("campaign") || "";
  const releaseIdParam = params.get("release") || "";
  const postIdParam = params.get("post") || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState(""); // "", preparing, publishing
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [instagram, setInstagram] = useState(null);
  const [day, setDay] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [release, setRelease] = useState(null);
  const [song, setSong] = useState(null);
  const [generated, setGenerated] = useState([]);
  const [video, setVideo] = useState(null);

  const [post, setPost] = useState(null);
  const [caption, setCaption] = useState("");
  const [captionSource, setCaptionSource] = useState("day");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("IMAGE");

  const artworkOptions = useMemo(() => {
    const opts = [];
    if (release?.artwork_url) {
      opts.push({ id: "release", label: "Release artwork", url: release.artwork_url });
    }
    if (song?.artwork_url && song.artwork_url !== release?.artwork_url) {
      opts.push({ id: "song", label: "Song artwork", url: song.artwork_url });
    }
    return opts;
  }, [release, song]);

  const videoReady =
    video &&
    video.rendering_status === "complete" &&
    video.render_output_url &&
    /^https:\/\//i.test(video.render_output_url);

  const publishBlocker = getInstagramPublishBlocker({
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
      const ig = (status?.connections || []).find((c) => c.provider === "instagram" && c.status === "connected");
      setInstagram(ig || null);

      if (postIdParam) {
        const res = await loadPost(postIdParam);
        const p = res?.post;
        if (p) {
          setPost(p);
          setCaption(p.caption || "");
          setMediaUrl(p.mediaUrl || "");
          setMediaType(p.mediaType || "IMAGE");
        }
      }

      let dayRow = null;
      let campaignRow = null;
      let releaseRow = null;
      let songRow = null;

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
        const content = await db.entities.GeneratedContent.filter({ campaign_id: campaignId }, "-created_date", 50).catch(
          () => []
        );
        setGenerated((content || []).filter((c) => c.type === "caption" || !c.type));
      }

      if (dayRow?.video_project_id) {
        const vp = await db.entities.VideoProject.get(dayRow.video_project_id).catch(() => null);
        setVideo(vp);
      }

      if (!postIdParam) {
        const parts = [dayRow?.caption, dayRow?.hashtags, dayRow?.cta].filter(Boolean);
        setCaption(parts.join("\n\n").slice(0, INSTAGRAM_CAPTION_MAX));
        setCaptionSource("day");
        const art = releaseRow?.artwork_url || songRow?.artwork_url || "";
        setMediaUrl(art);
        setMediaType("IMAGE");
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load composer",
        description: e?.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [campaignIdParam, dayId, postIdParam, releaseIdParam, toast]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const onSelectCaptionSource = (value) => {
    setCaptionSource(value);
    if (value === "day" && day) {
      const parts = [day.caption, day.hashtags, day.cta].filter(Boolean);
      setCaption(parts.join("\n\n").slice(0, INSTAGRAM_CAPTION_MAX));
    } else if (value === "custom") {
      /* keep current */
    } else if (value.startsWith("gc:")) {
      const id = value.slice(3);
      const item = generated.find((g) => g.id === id);
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

      let res;
      if (post?.id) {
        res = await updatePost({ postId: post.id, ...payload });
      } else {
        res = await createPost(payload);
      }
      if (res?.error) {
        toast({ variant: "destructive", title: "Could not save draft", description: res.error });
        return;
      }
      setPost(res.post);
      toast({ title: "Draft saved", description: "You can keep editing. Publish when media and Instagram are ready." });
      if (res.post?.id && !postIdParam) {
        navigate(`/social/compose?post=${res.post.id}`, { replace: true });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save draft",
        description: e?.message || "Please try again.",
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
        variant: "destructive",
        title: "Cannot publish yet",
        description: blocker,
      });
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
      // Treat any error payload as failure (ok may be omitted on some SDK error shapes).
      if (res?.error && res?.ok !== true) {
        if (res.post) setPost(res.post);
        toast({
          variant: "destructive",
          title: res?.code === "UNAUTHORIZED" ? "Session expired" : "Publish failed",
          description: res.error,
        });
        await bootstrap();
        return;
      }
      if (res?.post) setPost(res.post);
      toast({
        title: "Published to Instagram",
        description: res?.post?.externalPermalink
          ? "Open the permalink from Social Hub to view the post."
          : "Your Instagram post was published.",
      });
      navigate("/social");
    } catch (e) {
      const status = e?.status || e?.response?.status || e?._httpStatus;
      const body = e?.data || e?.response?.data;
      toast({
        variant: "destructive",
        title: status === 401 || status === 403 ? "Session / auth error" : "Publish failed",
        description:
          body?.error ||
          e?.message ||
          (status ? `Request failed (${status})` : "Please try again."),
      });
    } finally {
      setPublishing(false);
      setPublishPhase("");
    }
  };

  const reconnect = async () => {
    console.log("Instagram Auth Triggered");
    try {
      const res = await startOAuth("instagram", { forceReauth: true });
      if (res?.authorizationUrl) {
        window.location.assign(res.authorizationUrl);
        return;
      }
      const error = {
        success: false,
        errorType: res?.errorType || res?.code || "MISSING_AUTHORIZATION_URL",
        message: res?.error || res?.message || "Could not start Instagram reconnect",
        stack: res?.stack || null,
        full: res,
      };
      console.error("--- INSTAGRAM DEBUG ERROR ---");
      console.error("Error Message:", error.message || error);
      console.error("Full Error Object:", JSON.stringify(error, null, 2));
      toast({ variant: "destructive", title: "Could not start Instagram reconnect", description: error.message });
    } catch (e) {
      console.error("--- INSTAGRAM DEBUG ERROR ---");
      console.error("Error Message:", e?.message || e);
      try {
        console.error("Full Error Object:", JSON.stringify(e, Object.getOwnPropertyNames(e || {}), 2));
      } catch {
        console.error("Full Error Object:", e);
      }
      toast({ variant: "destructive", title: "Reconnect failed", description: e?.message });
    }
  };

  if (loading) return <div className="h-64 animate-shimmer rounded-2xl" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button
        type="button"
        onClick={() => navigate("/social")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Social Hub
      </button>

      <PageHeader
        eyebrow="Instagram"
        title="Create post"
        description="Save drafts anytime. JPEG and Instagram publish rules apply only when you publish."
      />

      {!instagram ? (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">
          Instagram is not connected yet — you can still save a draft.{" "}
          <Link to="/social" className="text-primary underline">
            Connect in Social Hub
          </Link>{" "}
          before publishing.
        </div>
      ) : instagram.needsPublishReauth || instagram.canPublish === false ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-600">Reconnect required for publishing</p>
          <p className="mt-1 text-muted-foreground">
            Instagram currently granted:{" "}
            <code className="text-xs">{instagram.scopes || "none"}</code>. Reconnect via Facebook Login and approve{" "}
            <code className="text-xs">instagram_content_publish</code> plus Page permissions. Your Instagram
            Professional account must be linked to a Facebook Page.
          </p>
          <Button className="mt-3 rounded-full" size="sm" onClick={reconnect}>
            Reconnect Instagram
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Publishing as <span className="font-600 text-foreground">@{instagram.username || "instagram"}</span>
        </p>
      )}

      <section className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4">
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Context</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Campaign</dt>
            <dd className="font-600">{campaign?.name || campaign?.id || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Campaign day</dt>
            <dd className="font-600">
              {day ? `Day ${day.day_number || "—"} · ${day.content_type || day.platform || ""}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Release</dt>
            <dd className="font-600">{release?.title || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd>
              {post ? <StatusBadge status={post.status} /> : <span className="text-muted-foreground">New draft</span>}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <Label htmlFor="caption-source">Caption source</Label>
            <Select value={captionSource} onValueChange={onSelectCaptionSource}>
              <SelectTrigger id="caption-source" className="mt-1 w-56 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Campaign day copy</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
                {generated.map((g) => (
                  <SelectItem key={g.id} value={`gc:${g.id}`}>
                    Generated: {(g.content || "").slice(0, 40)}…
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {caption.length}/{INSTAGRAM_CAPTION_MAX}
          </p>
        </div>
        <Textarea
          value={caption}
          onChange={(e) => {
            setCaption(e.target.value.slice(0, INSTAGRAM_CAPTION_MAX));
            setCaptionSource("custom");
          }}
          rows={8}
          className="rounded-xl"
          placeholder="Write your Instagram caption…"
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4">
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Media</h2>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, and WebP artwork can be saved on a draft. Non-JPEG images are prepared automatically when you
          publish.
        </p>

        {artworkOptions.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {artworkOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectArtwork(opt.url)}
                className={`rounded-xl border p-2 text-left transition ${
                  mediaUrl === opt.url ? "border-primary bg-primary/5" : "border-border/60"
                }`}
              >
                <ArtworkImage src={opt.url} alt="" className="aspect-square w-full" rounded="rounded-lg" />
                <p className="mt-2 text-xs font-600">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {looksLikeJpegUrl(opt.url)
                    ? "JPEG — ready for Instagram"
                    : looksLikePngOrWebpUrl(opt.url)
                      ? "PNG/WebP — auto-prepared as JPEG on publish"
                      : "Will be checked and prepared on publish"}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No release/song artwork found. You can still save a draft.</p>
        )}

        {preparationHint && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
            {preparationHint}
          </div>
        )}

        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-sm">
          <p className="font-600">Linked video project</p>
          {!video && <p className="mt-1 text-muted-foreground">No video linked to this day.</p>}
          {video && !videoReady && (
            <p className="mt-1 text-muted-foreground">
              Video rendering is not available yet (preview only). Drafts can still use artwork images.
            </p>
          )}
          {videoReady && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 rounded-full"
              onClick={() => {
                setMediaUrl(video.render_output_url);
                setMediaType("REELS");
              }}
            >
              Use rendered video
            </Button>
          )}
        </div>
      </section>

      {publishBlocker && (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">
          <p className="font-600">Before publishing</p>
          <p className="mt-1 text-muted-foreground">{publishBlocker}</p>
        </div>
      )}

      {post?.status === POST_STATUS.FAILED && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-600">Last publish failed</p>
          <p className="mt-1">{post.errorMessage || "Instagram publishing failed. Try again."}</p>
          {post.errorCode && <p className="mt-1 text-xs text-muted-foreground">Code: {post.errorCode}</p>}
        </div>
      )}

      {post?.status === POST_STATUS.PUBLISHED && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
          <p className="font-600">Already published</p>
          {post.externalPermalink ? (
            <a href={post.externalPermalink} target="_blank" rel="noreferrer" className="mt-1 text-primary underline">
              View on Instagram
            </a>
          ) : (
            <p className="mt-1 text-muted-foreground">Post ID: {post.externalPostId}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button className="min-h-10 rounded-full" disabled={saving} onClick={saveDraft}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button
          className="min-h-10 rounded-full"
          disabled={publishing || post?.status === POST_STATUS.PUBLISHED || post?.status === POST_STATUS.PUBLISHING}
          onClick={requestPublish}
        >
          {publishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
          {publishing
            ? publishPhase === "preparing"
              ? "Preparing image…"
              : "Publishing to Instagram…"
            : post?.status === POST_STATUS.FAILED
              ? "Retry Publish"
              : "Publish to Instagram"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Publish to Instagram now?"
        description={
          <span className="space-y-2 block text-sm">
            <span className="block">
              <strong>Account:</strong> @{instagram?.username || "instagram"}
            </span>
            <span className="block line-clamp-4">
              <strong>Caption:</strong> {caption || "(empty)"}
            </span>
            <span className="block">
              <strong>Media:</strong> {mediaType} — {mediaUrl ? "selected" : "none"}
            </span>
            <span className="block text-muted-foreground">This posts immediately. Scheduling is not available yet.</span>
          </span>
        }
        confirmLabel="Publish now"
        onConfirm={runPublish}
      />
    </div>
  );
}
