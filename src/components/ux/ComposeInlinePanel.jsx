import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/ConfirmDialog";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/ui/use-toast";
import { useCampaignDayCompose } from "@/hooks/useCampaignDayCompose";
import { INSTAGRAM_CAPTION_MAX } from "@/services/social/publishValidation";
import { SOCIAL_PROVIDERS, POST_STATUS } from "@/services/socialService";

/** Compact save draft + publish for the day action drawer. */
export default function ComposeInlinePanel({ day, campaign, release, posts = [], onPublished }) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const compose = useCampaignDayCompose({
    day,
    campaign,
    release,
    existingPosts: posts,
    enabled: Boolean(day?.id && campaign?.id),
  });

  const {
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
    videoReady,
    publishBlocker,
    saveDraft,
    runPublish,
    reconnect,
    useRenderedVideo,
  } = compose;

  const providerLabel =
    SOCIAL_PROVIDERS.find((p) => p.id === providerId)?.name || day?.platform || "Social";

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-border/60 bg-muted/20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const onSave = async () => {
    const res = await saveDraft();
    if (!res.ok) {
      toast({ variant: "destructive", title: "Could not save draft", description: res.error });
      return;
    }
    toast({ title: "Draft saved", description: `Ready to publish to ${providerLabel} when connected.` });
  };

  const requestPublish = () => {
    if (publishBlocker) {
      toast({ variant: "destructive", title: "Cannot publish yet", description: publishBlocker });
      return;
    }
    setConfirmOpen(true);
  };

  const onConfirmPublish = async () => {
    setConfirmOpen(false);
    if (!post?.id) {
      const saved = await saveDraft();
      if (!saved.ok) {
        toast({ variant: "destructive", title: "Could not save draft", description: saved.error });
        return;
      }
    }
    const res = await runPublish();
    if (!res.ok) {
      toast({ variant: "destructive", title: "Publish failed", description: res.error });
      return;
    }
    toast({
      title: `Published to ${providerLabel}`,
      description: res.post?.externalPermalink ? "Your post is live." : "Post submitted.",
    });
    onPublished?.();
  };

  const published = post?.status === POST_STATUS.PUBLISHED;

  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3" data-tour="launch-compose">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-xs font-600 uppercase tracking-wider text-muted-foreground">
          Quick post
        </h3>
        {post ? <StatusBadge status={post.status} /> : null}
      </div>

      {!connection ? (
        <p className="text-xs text-muted-foreground">
          Connect {providerLabel} in{" "}
          <Link to="/social/connect" className="text-primary underline">
            Social
          </Link>{" "}
          to publish. Drafts still save here.
        </p>
      ) : connection.needsPublishReauth || connection.canPublish === false ? (
        <div className="space-y-2 text-xs">
          <p className="text-amber-700 dark:text-amber-300">Reconnect required to publish.</p>
          <Button type="button" size="sm" className="rounded-full" onClick={() => reconnect()}>
            Reconnect {providerLabel}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Publishing as @{connection.username || providerId}
        </p>
      )}

      <div>
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <Label htmlFor={`inline-caption-${day?.id}`}>Caption</Label>
          <span>
            {caption.length}/{INSTAGRAM_CAPTION_MAX}
          </span>
        </div>
        <Textarea
          id={`inline-caption-${day?.id}`}
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, INSTAGRAM_CAPTION_MAX))}
          rows={4}
          className="rounded-xl text-sm"
          placeholder="Edit caption before posting…"
        />
      </div>

      {videoReady ? (
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={useRenderedVideo}>
          Use rendered video
        </Button>
      ) : null}

      {publishBlocker && !published ? (
        <p className="text-xs text-muted-foreground">{publishBlocker}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={saving || published}
          onClick={onSave}
        >
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Save draft
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          disabled={publishing || published || post?.status === POST_STATUS.PUBLISHING}
          onClick={requestPublish}
        >
          {publishing ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1 h-3.5 w-3.5" />
          )}
          {publishing
            ? publishPhase === "preparing"
              ? "Preparing…"
              : "Publishing…"
            : published
              ? "Published"
              : `Publish`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Publish to ${providerLabel} now?`}
        description={
          <span className="block space-y-1 text-sm">
            <span className="block line-clamp-3">{caption || "(empty caption)"}</span>
            <span className="block text-muted-foreground">
              {mediaType} · {mediaUrl ? "media attached" : "no media"}
            </span>
            {compose.providerId === "tiktok" ? (
              <span className="block text-xs text-muted-foreground">
                By posting, you agree to TikTok&apos;s Music Usage Confirmation. Posts publish as Only me (private);
                switch to Everyone in TikTok when you want them public.
              </span>
            ) : null}
          </span>
        }
        confirmLabel="Publish now"
        onConfirm={onConfirmPublish}
      />
    </section>
  );
}
