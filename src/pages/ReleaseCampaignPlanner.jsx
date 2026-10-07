import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Rocket, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import PromoFlowStepper from "@/components/ux/PromoFlowStepper";
import SurfacePanel from "@/components/SurfacePanel";
import ReleasePickOrCreateStep from "@/components/releases/ReleasePickOrCreateStep";
import ReleaseInfoStep from "@/components/releases/ReleaseInfoStep";
import ReleaseTracksUploadStep from "@/components/releases/ReleaseTracksUploadStep";
import ReleaseTracksLyricsStep from "@/components/releases/ReleaseTracksLyricsStep";
import ReleasePromoVideoStep from "@/components/releases/ReleasePromoVideoStep";
import ReleasePlatformAssignStep from "@/components/releases/ReleasePlatformAssignStep";
import { saveWizardDayPlatforms } from "@/services/releaseWizardPlan";
import { loadArtists, loadRelease } from "@/services/data";
import { allSongsHaveAudio } from "@/services/releaseDefaults";
import { generateCampaignForAlbum, generateCampaignForSong } from "@/services/createCampaignCore";
import { triggerCampaignAutoVideo } from "@/services/socialService";
import { resolveReleaseCampaignState } from "@/services/releaseCampaignMode";
import { sortReleaseTracks, staggeredStartDate } from "@/services/releaseTracks";
import { todayISO } from "@/services/format";
import { computeCampaignStartForReleaseDate } from "@/services/campaignReleaseTimeline";
import { billingFailureToast } from "@/lib/billingErrors";
import { chunkLoadUserMessage, reloadOnceOnChunkError } from "@/lib/chunkLoadError";
import { getSettings } from "@/services/settings";

const DEFAULT_PUBLISH_PLATFORMS = ["tiktok", "instagram", "youtube"];
const STEPS_WITH_RELEASE = ["Release", "Audio", "Lyrics", "Videos", "Platforms"];
const STEPS_WITHOUT_RELEASE = ["Start", ...STEPS_WITH_RELEASE];

const WIZARD_CAMPAIGN_IDS_KEY = "musicpromo:wizard-campaign-ids";

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
  const [planRows, setPlanRows] = useState([]);
  const [savingPlatforms, setSavingPlatforms] = useState(false);
  const detailsStepRef = useRef(null);

  const stepLabels = releaseId ? STEPS_WITH_RELEASE : STEPS_WITHOUT_RELEASE;
  const detailsStepIndex = releaseId ? 0 : 1;
  const uploadStepIndex = detailsStepIndex + 1;
  const lyricsStepIndex = uploadStepIndex + 1;
  const videoStepIndex = lyricsStepIndex + 1;
  const platformStepIndex = videoStepIndex + 1;

  const settings = getSettings();
  const [rollout, setRollout] = useState({
    goals: ["Promote an album", "Increase streams"],
    durationDays: settings.defaultDuration || 14,
    startDate: todayISO(),
    anchorToReleaseDate: true,
    publishPlatforms: DEFAULT_PUBLISH_PLATFORMS,
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
          publishProviderIds: DEFAULT_PUBLISH_PLATFORMS,
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
            publishProviderIds: DEFAULT_PUBLISH_PLATFORMS,
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
      if (releaseId && out.length) {
        sessionStorage.setItem(
          WIZARD_CAMPAIGN_IDS_KEY,
          JSON.stringify(out.map((r) => r.campaignId).filter(Boolean))
        );
      }
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
      setStep(platformStepIndex);
    } catch (e) {
      if (reloadOnceOnChunkError(e)) return;
      const fail = billingFailureToast(e);
      const description = chunkLoadUserMessage(e) || fail.description;
      toast({ variant: "destructive", title: fail.title, description });
    } finally {
      setGenerating(false);
      setStage("");
    }
  };

  const wizardCampaignIds = useMemo(() => {
    if (results.length) return results.map((r) => r.campaignId).filter(Boolean);
    try {
      const raw = sessionStorage.getItem(WIZARD_CAMPAIGN_IDS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }, [results]);

  const handleVideoStep = () => {
    if (needsGeneration) requireAuth(runBatch);
    else setStep(platformStepIndex);
  };

  const finishWizard = async () => {
    setSavingPlatforms(true);
    try {
      if (planRows.length) await saveWizardDayPlatforms(planRows);
      toast({ title: "You're ready to launch", description: "Platform choices saved for each plan day." });
      navigate(`/releases/${releaseId}/launch`);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save", description: e.message });
    } finally {
      setSavingPlatforms(false);
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
        eyebrow="Guided setup"
        title="Launch your release promo"
        description="A simple path from release → audio → optional lyrics → AI promo videos → choosing platforms."
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

        {releaseId && !loading && data?.release && step === lyricsStepIndex ? (
          <ReleaseTracksLyricsStep songs={songs} onSaved={reload} />
        ) : null}

        {releaseId && data?.release && step === videoStepIndex ? (
          <ReleasePromoVideoStep
            rollout={rollout}
            setRollout={setRollout}
            toggleGoal={toggleGoal}
            isAlbum={isAlbum}
            releaseDate={data.release.release_date || ""}
            generating={generating}
            stage={stage}
            needsGeneration={needsGeneration}
            pendingTrackCount={pendingTrackCount}
            uploadsReady={uploadsReady}
            onGenerate={handleVideoStep}
          />
        ) : null}

        {releaseId && data?.release && step === platformStepIndex ? (
          <>
            <ReleasePlatformAssignStep
              releaseId={releaseId}
              campaignIds={wizardCampaignIds}
              defaultPlatforms={DEFAULT_PUBLISH_PLATFORMS}
              onRowsChange={setPlanRows}
            />
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border/40 pt-5">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate("/social/connect")}>
                <Share2 className="mr-1.5 h-4 w-4" /> Connect accounts
              </Button>
              {wizardCampaignIds[0] ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => navigate(`/campaigns/${wizardCampaignIds[0]}/videos`)}
                >
                  Review videos
                </Button>
              ) : null}
            </div>
          </>
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
            {step < videoStepIndex && step !== platformStepIndex ? (
              <Button
                type="button"
                className="rounded-full"
                disabled={savingDetails || (step === uploadStepIndex && !uploadsReady)}
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
                ) : step === lyricsStepIndex ? (
                  <>Skip or continue <ArrowRight className="ml-1.5 h-4 w-4" /></>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : null}
            {step === platformStepIndex ? (
              <Button type="button" className="rounded-full" disabled={savingPlatforms} onClick={finishWizard}>
                {savingPlatforms ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rocket className="mr-1.5 h-4 w-4" />}
                Save & open launch board
              </Button>
            ) : null}
          </div>
        ) : null}
      </SurfacePanel>
    </div>
  );
}
