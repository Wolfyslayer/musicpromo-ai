import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Rocket, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import PromoFlowStepper from "@/components/ux/PromoFlowStepper";
import SurfacePanel from "@/components/SurfacePanel";
import ReleasePickOrCreateStep from "@/components/releases/ReleasePickOrCreateStep";
import ReleaseInfoStep from "@/components/releases/ReleaseInfoStep";
import ReleaseTracksUploadStep from "@/components/releases/ReleaseTracksUploadStep";
import { loadArtists, loadRelease } from "@/services/data";
import { allSongsHaveAudio } from "@/services/releaseDefaults";
import { CAMPAIGN_DURATIONS, CAMPAIGN_GOALS } from "@/services/constants";
import { generateCampaignForAlbum, generateCampaignForSong } from "@/services/createCampaignCore";
import { triggerCampaignAutoVideo } from "@/services/socialService";
import { resolveReleaseCampaignState } from "@/services/releaseCampaignMode";
import { sortReleaseTracks, staggeredStartDate } from "@/services/releaseTracks";
import { todayISO } from "@/services/format";
import {
  campaignEndDate,
  computeCampaignStartForReleaseDate,
} from "@/services/campaignReleaseTimeline";
import { billingFailureToast } from "@/lib/billingErrors";
import { getSettings } from "@/services/settings";

const STEPS_WITH_RELEASE = ["Release info", "Track audio", "Video rollout", "Plan & encode", "Launch"];
const STEPS_WITHOUT_RELEASE = ["Pick release", ...STEPS_WITH_RELEASE];

export default function ReleaseCampaignPlanner() {
  const [searchParams] = useSearchParams();
  const releaseId = searchParams.get("release") || "";
  const focusSongId = searchParams.get("song") || "";
  const navigate = useNavigate();
  const [artists, setArtists] = useState([]);
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(releaseId));
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");
  const [results, setResults] = useState([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const detailsStepRef = useRef(null);

  const stepLabels = releaseId ? STEPS_WITH_RELEASE : STEPS_WITHOUT_RELEASE;
  const detailsStepIndex = releaseId ? 0 : 1;
  const uploadStepIndex = detailsStepIndex + 1;
  const rolloutStepIndex = uploadStepIndex + 1;
  const generateStepIndex = rolloutStepIndex + 1;
  const socialStepIndex = generateStepIndex + 1;

  const settings = getSettings();
  const [rollout, setRollout] = useState({
    goals: ["Promote an album", "Increase streams"],
    durationDays: settings.defaultDuration || 14,
    startDate: todayISO(),
    anchorToReleaseDate: true,
    publishPlatforms: ["tiktok", "instagram", "youtube"],
    daysBetweenTracks: 7,
    promoStylePreset: settings.defaultTemplate ? "viral-pop" : "viral-pop",
    encodePromos: true,
    renderMode: "all",
  });

  const reload = () =>
    loadRelease(releaseId)
      .then(setData)
      .catch(() => setData(null));

  useEffect(() => {
    loadArtists().then(setArtists).catch(() => setArtists([]));
  }, []);

  useEffect(() => {
    if (!releaseId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [releaseId]);

  useEffect(() => {
    if (releaseId && focusSongId && data?.release && !loading) {
      setStep(uploadStepIndex);
    }
  }, [releaseId, focusSongId, data?.release, loading, uploadStepIndex]);

  useEffect(() => {
    const releaseDate = data?.release?.release_date;
    if (!releaseDate) return;
    setRollout((r) => {
      if (!r.anchorToReleaseDate) return r;
      const startDate = computeCampaignStartForReleaseDate(releaseDate, r.durationDays) || releaseDate;
      return { ...r, startDate, anchorToReleaseDate: true };
    });
  }, [data?.release?.release_date]);

  useEffect(() => {
    const releaseDate = data?.release?.release_date;
    if (!releaseDate || rollout.anchorToReleaseDate === false) return;
    const startDate = computeCampaignStartForReleaseDate(releaseDate, rollout.durationDays);
    if (!startDate) return;
    setRollout((r) => (r.startDate === startDate ? r : { ...r, startDate }));
  }, [data?.release?.release_date, rollout.durationDays, rollout.anchorToReleaseDate]);

  const songs = useMemo(() => sortReleaseTracks(data?.songs || []), [data?.songs]);
  const campaigns = data?.campaigns || [];
  const campaignState = useMemo(
    () => resolveReleaseCampaignState(data?.release, songs, campaigns),
    [data?.release, songs, campaigns]
  );
  const { isAlbum, needsGeneration, pendingTrackCount, tracksNeedingCampaign } = campaignState;
  const uploadsReady = allSongsHaveAudio(songs);

  const continueFromDetails = async () => {
    setSavingDetails(true);
    try {
      const ok = await detailsStepRef.current?.saveAll?.({ quiet: false });
      if (!ok) return;
      await reload();
      setStep((s) => s + 1);
    } finally {
      setSavingDetails(false);
    }
  };

  const toggleGoal = (g) =>
    setRollout((r) => ({
      ...r,
      goals: r.goals.includes(g) ? r.goals.filter((x) => x !== g) : [...r.goals, g],
    }));

  const onReleaseReady = (id) => {
    navigate(`/create?release=${id}`, { replace: true });
    setStep(0);
    setResults([]);
  };

  const runBatch = async () => {
    setGenerating(true);
    setResults([]);
    const out = [];
    try {
      if (isAlbum) {
        setStage(`Album: ${data.release.title}`);
        const { campaign, renderSummary } = await generateCampaignForAlbum({
          release: data.release,
          songs,
          artist: data.artist,
          goals: rollout.goals,
          durationDays: rollout.durationDays,
          startDate: rollout.startDate,
          promoStylePreset: rollout.promoStylePreset,
          publishProviderIds: rollout.publishPlatforms,
          userId: user?.id || "",
          onStage: setStage,
          renderVideos: rollout.encodePromos,
          renderMode: rollout.renderMode,
          triggerCampaignAutoVideo,
        });
        out.push({
          campaignId: campaign.id,
          title: data.release.title,
          videosRendered: renderSummary?.rendered || 0,
        });
      } else {
        const queue = tracksNeedingCampaign || [];
        for (let i = 0; i < queue.length; i++) {
          const song = queue[i];
          const trackIndex = songs.findIndex((s) => s.id === song.id);
          const startDate = staggeredStartDate(rollout.startDate, trackIndex, rollout.daysBetweenTracks);
          setStage(`Track ${trackIndex + 1}/${songs.length}: ${song.title}`);
          const { campaign, renderSummary } = await generateCampaignForSong({
            song: { ...song, artwork_url: song.artwork_url || data.release?.artwork_url },
            artist: data.artist,
            release: data.release,
            songs,
            releaseId,
            goals: rollout.goals,
            durationDays: rollout.durationDays,
            startDate,
            staggeredStartDate: startDate,
            promoStylePreset: rollout.promoStylePreset,
            publishProviderIds: rollout.publishPlatforms,
            userId: user?.id || "",
            onStage: setStage,
            renderVideos: rollout.encodePromos,
            renderMode: rollout.renderMode,
            triggerCampaignAutoVideo,
          });
          out.push({
            songId: song.id,
            campaignId: campaign.id,
            title: song.title,
            videosRendered: renderSummary?.rendered || 0,
          });
        }
      }
      setResults(out);
      const totalVideos = out.reduce((n, r) => n + (r.videosRendered || 0), 0);
      toast({
        title: out.length
          ? isAlbum
            ? "Album campaign plan created"
            : `${out.length} campaign plan${out.length === 1 ? "" : "s"} created`
          : isAlbum
            ? "Album already has a campaign"
            : "All tracks already had campaigns",
        description:
          totalVideos > 0
            ? `${totalVideos} promo video${totalVideos === 1 ? "" : "s"} encoded — edit any day in Campaign → Videos.`
            : rollout.encodePromos
              ? "Video drafts created — open Campaign → Videos to render on this device."
              : undefined,
      });
      await reload();
      setStep(socialStepIndex);
    } catch (e) {
      const fail = billingFailureToast(e);
      toast({ variant: "destructive", title: fail.title, description: fail.description });
    } finally {
      setGenerating(false);
      setStage("");
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => (releaseId ? navigate(`/releases/${releaseId}`) : navigate("/"))}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {releaseId ? "Back to release" : "Back to dashboard"}
      </button>

      <PageHeader
        eyebrow="Promo-first workflow"
        title="Build your release promo"
        description="Upload your music, generate a day-by-day promo plan with hooks and captions, encode short-form videos, then schedule posts — no AI song generation, just promotion."
      />

      <PromoFlowStepper labels={stepLabels} currentIndex={step} />

      <SurfacePanel>
        {!releaseId && step === 0 ? <ReleasePickOrCreateStep onReleaseReady={onReleaseReady} /> : null}

        {releaseId && loading ? <div className="h-32 animate-shimmer rounded-2xl" /> : null}

        {releaseId && !loading && !data?.release ? (
          <p className="text-destructive">
            Release not found.{" "}
            <Link to="/releases" className="underline">
              Back to releases
            </Link>
          </p>
        ) : null}

        {releaseId && !loading && data?.release && step === detailsStepIndex ? (
          <ReleaseInfoStep ref={detailsStepRef} release={data.release} artists={artists} onSaved={reload} />
        ) : null}

        {releaseId && !loading && data?.release && step === uploadStepIndex ? (
          <ReleaseTracksUploadStep
            release={data.release}
            songs={songs}
            focusSongId={focusSongId}
            onSaved={reload}
            requireAuth={requireAuth}
          />
        ) : null}

        {releaseId && data?.release && step === rolloutStepIndex ? (
          <RolloutStep
            rollout={rollout}
            setRollout={setRollout}
            toggleGoal={toggleGoal}
            isAlbum={isAlbum}
            releaseDate={data.release.release_date || ""}
          />
        ) : null}

        {releaseId && data?.release && step === generateStepIndex ? (
          <GenerateStep
            generating={generating}
            stage={stage}
            isAlbum={isAlbum}
            needsGeneration={needsGeneration}
            pendingTrackCount={pendingTrackCount}
          />
        ) : null}

        {releaseId && data?.release && step === socialStepIndex ? (
          <SocialStep release={data.release} releaseId={releaseId} results={results} navigate={navigate} />
        ) : null}

        {releaseId && data?.release ? (
          <div className="mt-6 flex justify-between">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              disabled={(step === detailsStepIndex && !releaseId) || generating}
              onClick={() => {
                if (step === detailsStepIndex) {
                  navigate("/create", { replace: true });
                  setStep(0);
                  return;
                }
                setStep((s) => s - 1);
              }}
            >
              Back
            </Button>
            {step < generateStepIndex && (
              <Button
                type="button"
                className="rounded-full"
                disabled={
                  savingDetails ||
                  (step === uploadStepIndex && !uploadsReady)
                }
                onClick={() => {
                  if (step === detailsStepIndex) {
                    requireAuth(continueFromDetails);
                    return;
                  }
                  setStep((s) => s + 1);
                }}
              >
                {savingDetails ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                )}
                Continue
              </Button>
            )}
            {step === generateStepIndex && !generating && (
              <Button
                type="button"
                className="rounded-full"
                disabled={!uploadsReady}
                onClick={() => requireAuth(needsGeneration ? runBatch : () => setStep(socialStepIndex))}
              >
                {needsGeneration ? (isAlbum ? "Generate album campaign" : "Generate campaigns") : "Continue"}
              </Button>
            )}
            {step === socialStepIndex ? (
              <Button type="button" className="rounded-full" onClick={() => navigate(`/releases/${releaseId}/launch`)}>
                Done
              </Button>
            ) : null}
          </div>
        ) : null}
      </SurfacePanel>
    </div>
  );
}

const PUBLISH_PLATFORM_OPTIONS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram Reels" },
  { id: "youtube", label: "YouTube Shorts" },
  { id: "x", label: "X" },
];

function RolloutStep({ rollout, setRollout, toggleGoal, isAlbum, releaseDate }) {
  const planEnd = campaignEndDate(rollout.startDate, rollout.durationDays);
  const togglePlatform = (id) =>
    setRollout((r) => {
      const set = new Set(r.publishPlatforms || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const publishPlatforms = [...set];
      return { ...r, publishPlatforms: publishPlatforms.length ? publishPlatforms : [id] };
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isAlbum
          ? "One album-wide plan: teaser videos before release day, a RELEASE promo on drop day, then post-launch posts."
          : "Each track gets a plan ending on release day (when set). Stagger starts when there is room before the release."}
      </p>
      {releaseDate ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Release day: <strong className="text-foreground">{releaseDate}</strong>
          {planEnd ? (
            <>
              {" "}
              · Plan runs <strong className="text-foreground">{rollout.startDate}</strong> →{" "}
              <strong className="text-foreground">{planEnd}</strong>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{isAlbum ? "Campaign start" : "Campaign start (track 1)"}</Label>
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
              End plan on release day (auto teaser run-up)
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
            <p className="text-xs text-muted-foreground">0 = all tracks share the same start date.</p>
          </div>
        ) : null}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">{isAlbum ? "Plan length" : "Plan length (per track)"}</Label>
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
      <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border/60 bg-muted/15 p-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={rollout.encodePromos !== false}
          onChange={(e) => setRollout((r) => ({ ...r, encodePromos: e.target.checked }))}
        />
        <span>
          <span className="font-500 text-foreground">Encode promo videos after the plan</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Uses the AI hook + best clip of each track (browser encode). Required for TikTok/YouTube auto-publish.
            Edit any clip in Campaign → Videos.
          </span>
        </span>
      </label>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Auto-publish platforms (each plan day)</Label>
        <p className="text-xs text-muted-foreground">
          When you schedule or encode with auto-publish, we queue a post on every platform you select (connected
          accounts required).
        </p>
        <div className="flex flex-wrap gap-2">
          {PUBLISH_PLATFORM_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlatform(p.id)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                (rollout.publishPlatforms || []).includes(p.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border"
              }`}
            >
              {p.label}
            </button>
          ))}
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
    </div>
  );
}

function GenerateStep({ generating, stage, isAlbum, needsGeneration, pendingTrackCount }) {
  return (
    <div className="space-y-4">
      {generating ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          {stage || "Generating…"}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {isAlbum ? (
              <>
                Creates <strong>one</strong> AI campaign plan (hooks, captions, and daily posts) for the full album
                {pendingTrackCount ? (
                  <>
                    {" "}
                    ({pendingTrackCount} track{pendingTrackCount === 1 ? "" : "s"} on the release).
                  </>
                ) : null}
              </>
            ) : (
              <>
                Creates AI campaign plans (hooks, captions, daily posts) for <strong>{pendingTrackCount}</strong> track
                {pendingTrackCount === 1 ? "" : "s"} without campaigns. Tracks that already have campaigns are skipped.
              </>
            )}
          </p>
          {!needsGeneration ? (
            <p className="text-sm text-primary">
              {isAlbum ? "This album already has a campaign — continue to social setup." : "Every track already has a campaign — continue to social setup."}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function SocialStep({ release, releaseId, results, navigate }) {
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" />
        Rollout is ready for social publishing.
      </p>
      {results.length ? (
        <ul className="text-sm text-muted-foreground">
          {results.map((r) => (
            <li key={r.campaignId}>
              {r.title} → campaign created
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="rounded-full" onClick={() => navigate(`/releases/${releaseId}/launch`)}>
          <Rocket className="mr-1.5 h-4 w-4" /> Launch board
        </Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate("/social/connect")}>
          <Share2 className="mr-1.5 h-4 w-4" /> Connect platforms
        </Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate("/social")}>
          Social Hub
        </Button>
      </div>
      {release.presave_url ? (
        <p className="text-xs text-muted-foreground">
          Pre-save link on this release:{" "}
          <a href={release.presave_url} className="text-primary underline" target="_blank" rel="noreferrer">
            {release.presave_url}
          </a>
        </p>
      ) : null}
    </div>
  );
}
