import { useEffect } from "react";
import { Film, Loader2, Sparkles } from "lucide-react";
import { importWithRetry } from "@/lib/chunkLoadError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import WizardStepIntro from "@/components/ux/WizardStepIntro";
import { CAMPAIGN_DURATIONS, CAMPAIGN_GOALS } from "@/services/constants";
import { campaignEndDate, computeCampaignStartForReleaseDate } from "@/services/campaignReleaseTimeline";

export default function ReleasePromoVideoStep({
  rollout,
  setRollout,
  toggleGoal,
  isAlbum,
  releaseDate,
  generating,
  stage,
  needsGeneration,
  pendingTrackCount,
  onGenerate,
  uploadsReady,
}) {
  const planEnd = campaignEndDate(rollout.startDate, rollout.durationDays);

  useEffect(() => {
    import("@/lib/chunkLoadError")
      .then(({ importWithRetry }) =>
        importWithRetry(() => import("@/remotion/renderPromoRemotion"), { reloadOnChunkError: false })
      )
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <WizardStepIntro
        title="Create promo videos"
        description={
          isAlbum
            ? "AI builds an album-wide posting plan, picks the best moment from each track, and encodes vertical promo clips on this device."
            : "AI plans your rollout, finds the strongest hook in each song, and encodes ready-to-post 9:16 videos."
        }
      />

      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] to-transparent p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Film className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="font-heading text-base font-semibold">Best-part clips, automatically</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Uses your audio{rollout.encodePromos !== false ? ", lyrics when provided," : ""} and artwork to render one
              promo per plan day. You can fine-tune clips later in Campaign → Videos.
            </p>
          </div>
        </div>
      </div>

      {releaseDate ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
          Release day: <strong className="text-foreground">{releaseDate}</strong>
          {planEnd ? (
            <>
              {" "}
              · Plan <strong className="text-foreground">{rollout.startDate}</strong> →{" "}
              <strong className="text-foreground">{planEnd}</strong>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{isAlbum ? "Campaign start" : "First track starts"}</Label>
          <Input
            type="date"
            value={rollout.startDate}
            disabled={Boolean(releaseDate && rollout.anchorToReleaseDate)}
            onChange={(e) => setRollout((r) => ({ ...r, startDate: e.target.value, anchorToReleaseDate: false }))}
            className="rounded-xl"
          />
          {releaseDate ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={rollout.anchorToReleaseDate !== false}
                onChange={(e) => {
                  const anchor = e.target.checked;
                  setRollout((r) => ({
                    ...r,
                    anchorToReleaseDate: anchor,
                    startDate: anchor
                      ? computeCampaignStartForReleaseDate(releaseDate, r.durationDays) || r.startDate
                      : r.startDate,
                  }));
                }}
              />
              End plan on release day
            </label>
          ) : null}
        </div>
        {!isAlbum ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Days between track campaigns</Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={rollout.daysBetweenTracks}
              onChange={(e) => setRollout((r) => ({ ...r, daysBetweenTracks: Number(e.target.value) }))}
              className="rounded-xl"
            />
          </div>
        ) : null}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Plan length</Label>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_DURATIONS.map((d) => (
              <button
                key={d.days}
                type="button"
                onClick={() => setRollout((r) => ({ ...r, durationDays: d.days }))}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  rollout.durationDays === d.days ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Goals</Label>
        <div className="flex flex-wrap gap-2">
          {CAMPAIGN_GOALS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGoal(g)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                rollout.goals.includes(g) ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border/40 pt-5">
        {generating ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">{stage || "Creating your promo plan & videos…"}</p>
            <p className="max-w-sm text-xs text-muted-foreground">This runs in your browser — keep this tab open until encoding finishes.</p>
          </div>
        ) : (
          <>
            {!needsGeneration ? (
              <p className="mb-3 text-sm text-primary">
                {isAlbum ? "Album campaign already exists — continue to choose platforms." : "All tracks have campaigns — continue to platforms or regenerate below."}
              </p>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">
                {isAlbum
                  ? `One album plan covering ${pendingTrackCount || "all"} tracks.`
                  : `${pendingTrackCount} track${pendingTrackCount === 1 ? "" : "s"} will get a new plan and videos.`}
              </p>
            )}
            <Button
              type="button"
              size="lg"
              className="w-full rounded-2xl sm:w-auto sm:min-w-[16rem]"
              disabled={!uploadsReady}
              onClick={onGenerate}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {needsGeneration ? "Create plan & promo videos" : "Continue to platforms"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
