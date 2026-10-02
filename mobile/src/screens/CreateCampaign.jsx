import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, AudioLines, FileText, ImageIcon, Music2, Sparkles, Target, Wand2 } from "lucide-react-native";
import { db } from "@/api/db";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import {
  GeneratingScreen,
  Stepper,
  StepArtwork,
  StepAudio,
  StepGoals,
  StepLyrics,
  StepSong,
  StepSummary,
  WEB_RENDER_NOTE,
} from "@/components/create/CreateSteps";
import { useAuth } from "@/lib/AuthContext";
import { loadArtists, loadReleases } from "@/services/data";
import { aiService } from "@/services/aiService";
import { DEFAULT_SETTINGS, getSettings } from "@/services/settings";
import { todayISO, addDaysISO } from "@/services/format";

const STEPS = [
  { key: "song", label: "Song", icon: Music2 },
  { key: "artwork", label: "Artwork", icon: ImageIcon },
  { key: "audio", label: "Audio", icon: AudioLines },
  { key: "lyrics", label: "Lyrics", icon: FileText },
  { key: "goals", label: "Goals", icon: Target },
  { key: "generate", label: "Generate", icon: Wand2 },
];

export default function CreateCampaign() {
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [step, setStep] = useState(0);
  const artistsQuery = useQuery({ queryKey: ["artists", user?.id], queryFn: () => loadArtists().catch(() => []) });
  const releasesQuery = useQuery({ queryKey: ["releases", user?.id], queryFn: () => loadReleases().catch(() => []) });
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const artists = artistsQuery.data || [];
  const releases = releasesQuery.data || [];
  const [form, setForm] = useState(() => ({
    artistMode: "existing", artistId: "", newArtistName: "", newArtistGenre: "",
    releaseId: "",
    title: "", genre: "", releaseDate: todayISO(), language: "English", description: "",
    artworkUrl: "", artworkFile: null,
    audioUri: "", audioSignedUrl: "", audioDuration: null, audioName: "", audioFile: null,
    lyrics: "", goals: [], durationDays: null, startDate: todayISO(),
  }));
  const durationDays = form.durationDays ?? settingsQuery.data?.defaultDuration ?? DEFAULT_SETTINGS.defaultDuration;
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const selectArtist = (v) => {
    if (v === "__new__") {
      setForm((f) => ({ ...f, artistMode: "new", artistId: "", releaseId: "" }));
      return;
    }
    setForm((f) => {
      const releaseStillValid = !f.releaseId || releases.find((r) => r.id === f.releaseId)?.artist_id === v;
      return {
        ...f,
        artistMode: "existing",
        artistId: v,
        releaseId: releaseStillValid ? f.releaseId : "",
      };
    });
  };

  const selectRelease = (v) => {
    if (v === "__none__") {
      set("releaseId", "");
      return;
    }
    const release = releases.find((r) => r.id === v);
    setForm((f) => ({
      ...f,
      releaseId: v,
      artistMode: "existing",
      artistId: release?.artist_id || f.artistId,
    }));
  };

  const canContinue = () => {
    if (step === 0) {
      if (form.artistMode === "new") return Boolean(form.newArtistName.trim() && form.title.trim());
      return Boolean(form.artistId && form.title.trim());
    }
    return true;
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const toggleGoal = (g) => setForm((f) => ({ ...f, goals: f.goals.includes(g) ? f.goals.filter((x) => x !== g) : [...f.goals, g] }));

  const generate = async () => {
    setGenerating(true);
    try {
      const me = user || (await db.auth.me().catch(() => null));

      setStage("Preparing artist…");
      let artistId = form.artistId;
      if (form.artistMode === "new") {
        const a = await db.entities.Artist.create({ name: form.newArtistName.trim(), genre: form.newArtistGenre, is_demo: false });
        artistId = a.id;
      }
      const artist = artists.find((a) => a.id === artistId) || { name: form.newArtistName, genre: form.newArtistGenre };

      setStage("Saving song…");
      const songPayload = {
        artist_id: artistId, title: form.title.trim(), genre: form.genre, release_date: form.releaseDate,
        language: form.language, description: form.description, artwork_url: form.artworkUrl,
        audio_url: form.audioUri, audio_duration: form.audioDuration, lyrics: form.lyrics,
        analysis: null, is_demo: false,
      };
      if (form.releaseId) songPayload.release_id = form.releaseId;
      const song = await db.entities.Song.create(songPayload);

      const songForAI = { ...song, artistName: artist.name };

      setStage("Analyzing song with AI…");
      const generated = await aiService.analyzeSong(songForAI);
      const analysis = {
        ...(generated && typeof generated === "object" ? generated : {}),
        assetProfile: null,
      };
      await db.entities.Song.update(song.id, { analysis });

      setStage("Generating campaign with AI…");
      const result = await aiService.generateCampaign({
        song: songForAI, analysis, goals: form.goals, durationDays, startDate: form.startDate,
      });

      setStage("Building day-by-day schedule…");
      const endDate = addDaysISO(form.startDate, durationDays - 1);
      const campaignPayload = {
        song_id: song.id, artist_id: artistId, name: result.campaignName || `${form.title} Campaign`,
        status: form.startDate <= todayISO() ? "active" : "scheduled",
        duration_days: durationDays, goals: form.goals, start_date: form.startDate, end_date: endDate,
        summary: result.summary, is_demo: false,
      };
      if (form.releaseId) campaignPayload.release_id = form.releaseId;
      const campaign = await db.entities.Campaign.create(campaignPayload);
      const days = (result.days || []).map((d) => ({
        campaign_id: campaign.id, day_number: d.dayNumber, date: d.date, platform: d.platform,
        content_type: d.contentType, objective: d.objective, video_concept: d.videoConcept,
        hook: d.hook, video_template: d.videoTemplate,
        caption: d.caption, hashtags: d.hashtags, cta: d.cta, posting_time: d.postingTime, status: "planned",
        user_id: me?.id || "",
      }));
      if (days.length) await db.entities.CampaignDay.bulkCreate(days);

      toast({
        title: "Campaign generated!",
        description: form.artworkUrl && form.audioUri ? `Campaign ready. ${WEB_RENDER_NOTE}` : undefined,
      });
      router.replace(`/campaigns/${campaign.id}`);
    } catch (e) {
      setGenerating(false);
      setStage("");
      toast({ variant: "destructive", title: "Generation failed", description: e.message });
    }
  };

  return (
    <Screen contentClassName="gap-6">
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-2xl tracking-tight">New Campaign</Text>
        <Pressable onPress={() => router.push("/campaigns")} hitSlop={8} className="active:opacity-70">
          <Text className="text-sm text-muted-foreground">Cancel</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        <Stepper steps={STEPS} step={step} />
        <Text className="text-xs font-500 text-primary">
          Step {step + 1} of {STEPS.length} · {STEPS[step].label}
        </Text>
      </View>

      <View className="rounded-2xl border border-border/60 bg-card p-5">
        {generating ? (
          <GeneratingScreen stage={stage} />
        ) : (
          <>
            {step === 0 ? (
              <StepSong
                form={form}
                set={set}
                artists={artists}
                releases={releases}
                selectArtist={selectArtist}
                selectRelease={selectRelease}
              />
            ) : null}
            {step === 1 ? <StepArtwork form={form} setForm={setForm} /> : null}
            {step === 2 ? <StepAudio form={form} setForm={setForm} /> : null}
            {step === 3 ? <StepLyrics form={form} set={set} /> : null}
            {step === 4 ? <StepGoals form={form} durationDays={durationDays} set={set} toggleGoal={toggleGoal} /> : null}
            {step === 5 ? <StepSummary form={form} durationDays={durationDays} artists={artists} releases={releases} /> : null}

            <View className="mt-6 flex-row items-center justify-between">
              <Button variant="ghost" icon={ArrowLeft} onPress={back} disabled={step === 0} className="rounded-full">
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button iconRight={ArrowRight} onPress={next} disabled={!canContinue()} className="rounded-full">
                  Continue
                </Button>
              ) : (
                <Button icon={Sparkles} onPress={() => requireAuth(generate)} className="rounded-full">
                  Generate Campaign
                </Button>
              )}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
