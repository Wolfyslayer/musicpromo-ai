import { useEffect, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Chip, Field, Muted, P, Screen, SelectField } from "@/components/ui";
import { aiService } from "@/lib/ai";
import { CAMPAIGN_DURATIONS, CAMPAIGN_GOALS, CONTENT_TYPES, GENRES, LANGUAGES, PLATFORMS } from "@/lib/constants";
import { loadArtists, loadReleases } from "@/lib/data";
import { db } from "@/lib/db";
import { addDaysISO, errorMessage, todayISO } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { uploadPromoAsset } from "@/lib/store";
import type { Row } from "@/lib/types";

const STEPS = ["Song", "Artwork", "Audio", "Lyrics", "Goals", "Generate"];

function localPlan(input: { title: string; durationDays: number; startDate: string; platforms: string[] }) {
  const days = Array.from({ length: input.durationDays }, (_, index) => ({
    dayNumber: index + 1,
    date: addDaysISO(input.startDate, index),
    platform: input.platforms[index % input.platforms.length] || "TikTok",
    contentType: CONTENT_TYPES[index % CONTENT_TYPES.length],
    objective: "Promote the release",
    videoConcept: `${input.title} promo`,
    hook: input.title,
    caption: `New music: ${input.title}`,
    hashtags: ["#newmusic", "#musicpromo"],
    cta: "Listen now",
    postingTime: "18:00",
  }));
  return {
    campaignName: `${input.title} Campaign`,
    summary: "Built on device because AI campaign generation was unavailable.",
    days,
    local: true,
  };
}

export default function CreateCampaign() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [artists, setArtists] = useState<Row[]>([]);
  const [releases, setReleases] = useState<Row[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(["TikTok", "Instagram Reels", "YouTube Shorts"]);
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");
  const [form, setForm] = useState({
    artistMode: "existing",
    artistId: "",
    newArtistName: "",
    newArtistGenre: "",
    releaseId: "",
    title: "",
    genre: "",
    releaseDate: todayISO(),
    language: "English",
    description: "",
    artworkUrl: "",
    audioUrl: "",
    lyrics: "",
    goals: [] as string[],
    durationDays: 7,
    startDate: todayISO(),
  });

  useEffect(() => {
    loadArtists().then(setArtists).catch(() => setArtists([]));
    loadReleases().then(setReleases).catch(() => setReleases([]));
    getSettings().then((settings) => {
      setForm((current) => ({ ...current, durationDays: settings.defaultDuration }));
      setPlatforms(settings.defaultPlatforms);
    });
  }, []);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const canContinue =
    step !== 0 ||
    (form.artistMode === "new" ? Boolean(form.newArtistName.trim() && form.title.trim()) : Boolean(form.artistId && form.title.trim()));

  const pickArtwork = async () => {
    if (!requireAuth()) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const uploaded = await uploadPromoAsset(
        { uri: asset.uri, name: asset.fileName || "artwork.jpg", type: asset.mimeType || "image/jpeg" },
        "artwork"
      );
      set("artworkUrl", uploaded.file_url);
      toast({ title: "Artwork uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
  };

  const pickAudio = async () => {
    if (!requireAuth()) return;
    const result = await DocumentPicker.getDocumentAsync({ type: ["audio/*"], copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    try {
      const uploaded = await uploadPromoAsset({ uri: file.uri, name: file.name, type: file.mimeType || "audio/mpeg" }, "audio");
      set("audioUrl", uploaded.file_url);
      toast({ title: "Audio uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
  };

  const toggleGoal = (goal: string) => {
    setForm((current) => ({
      ...current,
      goals: current.goals.includes(goal) ? current.goals.filter((item) => item !== goal) : [...current.goals, goal],
    }));
  };

  const generate = async () => {
    if (!requireAuth()) return;
    setGenerating(true);
    try {
      setStage("Preparing artist…");
      let artistId = form.artistId;
      if (form.artistMode === "new") {
        const created = await db.entities.Artist.create({
          name: form.newArtistName.trim(),
          genre: form.newArtistGenre,
          is_demo: false,
        });
        artistId = created.id;
      }
      const artist = artists.find((item) => item.id === artistId) || { name: form.newArtistName, genre: form.newArtistGenre };
      setStage("Saving song…");
      const song = await db.entities.Song.create({
        artist_id: artistId,
        release_id: form.releaseId || null,
        title: form.title.trim(),
        genre: form.genre,
        release_date: form.releaseDate,
        language: form.language,
        description: form.description,
        artwork_url: form.artworkUrl,
        audio_url: form.audioUrl,
        lyrics: form.lyrics,
        is_demo: false,
      });
      setStage("Generating the campaign…");
      let plan: Row;
      try {
        const analysis = await aiService.analyzeSong({ ...song, artistName: artist.name });
        await db.entities.Song.update(song.id, { analysis });
        plan = await aiService.generateCampaign({
          song: { ...song, artistName: artist.name },
          analysis,
          goals: form.goals,
          durationDays: form.durationDays,
          startDate: form.startDate,
        });
      } catch {
        plan = localPlan({
          title: form.title.trim(),
          durationDays: form.durationDays,
          startDate: form.startDate,
          platforms,
        });
      }
      setStage("Saving the schedule…");
      const campaign = await db.entities.Campaign.create({
        song_id: song.id,
        artist_id: artistId,
        release_id: form.releaseId || null,
        name: plan.campaignName || `${form.title} Campaign`,
        status: form.startDate <= todayISO() ? "active" : "scheduled",
        duration_days: form.durationDays,
        goals: form.goals,
        start_date: form.startDate,
        end_date: addDaysISO(form.startDate, form.durationDays - 1),
        summary: plan.summary,
        is_demo: false,
        user_id: user?.id || "",
      });
      const days = (plan.days || []).map((day: Row) => ({
        campaign_id: campaign.id,
        day_number: day.dayNumber,
        date: day.date,
        platform: day.platform,
        content_type: day.contentType,
        objective: day.objective,
        video_concept: day.videoConcept,
        hook: day.hook,
        caption: day.caption,
        hashtags: day.hashtags,
        cta: day.cta,
        posting_time: day.postingTime,
        status: "planned",
      }));
      if (days.length) await db.entities.CampaignDay.bulkCreate(days);
      toast({
        title: plan.local ? "Campaign saved locally" : "Campaign created",
        description: plan.local ? "AI generation was unavailable, so a day plan was built on device. Video render stays on the web." : "Video render stays on the web studio.",
      });
      router.replace(`/campaigns/${campaign.id}`);
    } catch (err) {
      toast({ title: "Could not create campaign", description: errorMessage(err), variant: "destructive" });
    } finally {
      setGenerating(false);
      setStage("");
    }
  };

  return (
    <Screen>
      <View className="gap-4">
        <Muted>
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </Muted>
        <View className="flex-row flex-wrap gap-2">
          {STEPS.map((label, index) => (
            <Chip key={label} label={label} selected={index === step} onPress={() => setStep(index)} />
          ))}
        </View>
        {step === 0 && (
          <View className="gap-3">
            <View className="flex-row gap-2">
              <Chip label="Existing artist" selected={form.artistMode === "existing"} onPress={() => set("artistMode", "existing")} />
              <Chip label="New artist" selected={form.artistMode === "new"} onPress={() => set("artistMode", "new")} />
            </View>
            {form.artistMode === "existing" ? (
              <SelectField
                label="Artist"
                value={form.artistId}
                onChange={(value) => set("artistId", value)}
                options={artists.map((artist) => ({ label: artist.name, value: artist.id }))}
                placeholder="Select artist"
              />
            ) : (
              <>
                <Field label="New artist name" value={form.newArtistName} onChangeText={(value) => set("newArtistName", value)} autoCapitalize="words" />
                <SelectField
                  label="Artist genre"
                  value={form.newArtistGenre}
                  onChange={(value) => set("newArtistGenre", value)}
                  options={GENRES.map((genre) => ({ label: genre, value: genre }))}
                />
              </>
            )}
            <SelectField
              label="Release"
              value={form.releaseId}
              onChange={(value) => set("releaseId", value)}
              options={[{ label: "No release", value: "" }, ...releases.map((release) => ({ label: release.title, value: release.id }))]}
            />
            <Field label="Song title" value={form.title} onChangeText={(value) => set("title", value)} autoCapitalize="words" />
            <SelectField label="Genre" value={form.genre} onChange={(value) => set("genre", value)} options={GENRES.map((genre) => ({ label: genre, value: genre }))} />
            <SelectField label="Language" value={form.language} onChange={(value) => set("language", value)} options={LANGUAGES.map((language) => ({ label: language, value: language }))} />
            <Field label="Release date" value={form.releaseDate} onChangeText={(value) => set("releaseDate", value)} placeholder="YYYY-MM-DD" />
            <Field label="Description" value={form.description} onChangeText={(value) => set("description", value)} multiline autoCapitalize="sentences" />
          </View>
        )}
        {step === 1 && (
          <View className="gap-3">
            <Muted>Artwork is uploaded to the music-promo-assets bucket.</Muted>
            <Field label="Artwork URL" value={form.artworkUrl} onChangeText={(value) => set("artworkUrl", value)} placeholder="https://" />
            <Button label="Choose image" variant="outline" onPress={pickArtwork} />
          </View>
        )}
        {step === 2 && (
          <View className="gap-3">
            <Muted>Audio is stored for later web rendering. On-device waveform and lyrics sync are not included.</Muted>
            <Field label="Audio URL" value={form.audioUrl} onChangeText={(value) => set("audioUrl", value)} placeholder="https://" />
            <Button label="Choose audio" variant="outline" onPress={pickAudio} />
          </View>
        )}
        {step === 3 && <Field label="Lyrics" value={form.lyrics} onChangeText={(value) => set("lyrics", value)} multiline autoCapitalize="sentences" />}
        {step === 4 && (
          <View className="gap-3">
            <P className="font-semibold">Goals</P>
            <View className="flex-row flex-wrap gap-2">
              {CAMPAIGN_GOALS.map((goal) => (
                <Chip key={goal} label={goal} selected={form.goals.includes(goal)} onPress={() => toggleGoal(goal)} />
              ))}
            </View>
            <P className="font-semibold">Length</P>
            <View className="flex-row flex-wrap gap-2">
              {CAMPAIGN_DURATIONS.map((item) => (
                <Chip key={item.days} label={item.label} selected={form.durationDays === item.days} onPress={() => setForm((current) => ({ ...current, durationDays: item.days }))} />
              ))}
            </View>
            <Field label="Start date" value={form.startDate} onChangeText={(value) => set("startDate", value)} placeholder="YYYY-MM-DD" />
            <View className="flex-row flex-wrap gap-2">
              {PLATFORMS.map((platform) => (
                <Chip
                  key={platform.id}
                  label={platform.label}
                  selected={platforms.includes(platform.id)}
                  onPress={() =>
                    setPlatforms((current) =>
                      current.includes(platform.id) ? current.filter((item) => item !== platform.id) : [...current, platform.id]
                    )
                  }
                />
              ))}
            </View>
          </View>
        )}
        {step === 5 && (
          <View className="gap-3">
            <Muted>
              {form.title || "Untitled"} · {form.durationDays} days. Promo video rendering stays on the web studio.
            </Muted>
            {stage ? <Muted>{stage}</Muted> : null}
            <Button label="Create campaign" onPress={generate} loading={generating} />
          </View>
        )}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button label="Back" variant="outline" disabled={step === 0} onPress={() => setStep((value) => Math.max(0, value - 1))} />
          </View>
          {step < STEPS.length - 1 ? (
            <View className="flex-1">
              <Button label="Next" disabled={!canContinue} onPress={() => setStep((value) => value + 1)} />
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
