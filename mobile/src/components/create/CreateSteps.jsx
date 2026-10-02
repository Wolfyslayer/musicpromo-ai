import { ActivityIndicator, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, Info, Wand2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Chip } from "@/components/ui/controls";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import ArtworkImage from "@/components/ArtworkImage";
import ArtworkUpload from "@/components/ArtworkUpload";
import AudioUpload from "@/components/AudioUpload";
import { useAuth } from "@/lib/AuthContext";
import { BRAND_GRADIENT, useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { GENRES, LANGUAGES, CAMPAIGN_GOALS, CAMPAIGN_DURATIONS } from "@/services/constants";
import { fmtDate } from "@/services/format";

export const WEB_RENDER_NOTE = "Promo MP4s are rendered from the web studio for now.";

export function Stepper({ steps, step }) {
  return (
    <View className="flex-row items-center gap-1">
      {steps.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <View key={s.key} className={cn("flex-row items-center gap-1", i < steps.length - 1 && "flex-1")}>
            <View
              className={cn(
                "h-7 w-7 items-center justify-center rounded-full",
                active ? "bg-primary" : done ? "bg-primary/30" : "bg-muted"
              )}
              accessibilityLabel={s.label}
            >
              <Icon
                as={done ? Check : s.icon}
                size={14}
                className={active ? "text-primary-foreground" : done ? "text-primary" : "text-muted-foreground"}
              />
            </View>
            {i < steps.length - 1 ? <View className="h-px flex-1 bg-border/50" /> : null}
          </View>
        );
      })}
    </View>
  );
}

function MutedNote({ children }) {
  return (
    <View className="flex-row items-start gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
      <Icon as={Info} size={14} className="mt-0.5 text-muted-foreground" />
      <Text className="flex-1 text-xs text-muted-foreground">{children}</Text>
    </View>
  );
}

export function StepSong({ form, set, artists, releases, selectArtist, selectRelease }) {
  const artistReleases =
    form.artistMode === "existing" && form.artistId ? releases.filter((r) => r.artist_id === form.artistId) : releases;

  return (
    <View className="gap-4">
      <Field label="Artist">
        <Select
          value={form.artistMode === "new" ? "__new__" : form.artistId}
          onValueChange={selectArtist}
          placeholder="Select an artist"
          title="Artist"
          options={[...artists.map((a) => ({ value: a.id, label: a.name })), { value: "__new__", label: "＋ Create new artist" }]}
        />
      </Field>
      {form.artistMode === "new" ? (
        <>
          <Field label="New artist name">
            <Input value={form.newArtistName} onChangeText={(v) => set("newArtistName", v)} placeholder="Artist name" />
          </Field>
          <Field label="Genre">
            <Select value={form.newArtistGenre} onValueChange={(v) => set("newArtistGenre", v)} placeholder="Select genre" title="Genre" options={GENRES} />
          </Field>
        </>
      ) : null}
      {form.artistMode === "existing" ? (
        <Field label="Release (optional)" hint="Optional. Leave empty to keep the previous Artist → Song → Campaign flow.">
          <Select
            value={form.releaseId || "__none__"}
            onValueChange={selectRelease}
            placeholder="No release"
            title="Release"
            options={[{ value: "__none__", label: "No release" }, ...artistReleases.map((r) => ({ value: r.id, label: r.title }))]}
          />
        </Field>
      ) : null}
      <Field label="Song Title *">
        <Input value={form.title} onChangeText={(v) => set("title", v)} placeholder="e.g. Northern Light" />
      </Field>
      <Field label="Genre">
        <Select value={form.genre} onValueChange={(v) => set("genre", v)} placeholder="Select genre" title="Genre" options={GENRES} />
      </Field>
      <Field label="Release Date">
        <Input value={form.releaseDate} onChangeText={(v) => set("releaseDate", v)} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      </Field>
      <Field label="Language">
        <Select value={form.language} onValueChange={(v) => set("language", v)} title="Language" options={LANGUAGES} />
      </Field>
      <Field label="Song Description (optional)">
        <Textarea value={form.description} onChangeText={(v) => set("description", v)} numberOfLines={3} placeholder="What's the song about?" />
      </Field>
    </View>
  );
}

export function StepArtwork({ form, setForm }) {
  const { requireAuth } = useAuth();
  return (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">
        Upload your album or track artwork. This is used across your campaign and for promo video rendering.
      </Text>
      <ArtworkUpload
        guard={requireAuth}
        value={form.artworkUrl}
        onChange={(payload) => {
          const url = typeof payload === "string" ? payload : payload?.url || "";
          const file = typeof payload === "object" && payload ? payload.file : null;
          setForm((f) => ({ ...f, artworkUrl: url, artworkFile: file || null }));
        }}
      />
      {form.artworkUrl && form.audioUri ? <MutedNote>Audio analysis runs in the web studio.</MutedNote> : null}
    </View>
  );
}

export function StepAudio({ form, setForm }) {
  const { requireAuth } = useAuth();
  return (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">
        Upload your song. The audio is stored privately and used for promo video encoding.
      </Text>
      <AudioUpload
        guard={requireAuth}
        value={form.audioUri}
        signedUrl={form.audioSignedUrl}
        onChange={({ file_uri, signed_url, duration, name, file }) => {
          setForm((f) => ({
            ...f,
            audioUri: file_uri || "",
            audioSignedUrl: signed_url || "",
            audioDuration: duration,
            audioName: name || "",
            audioFile: file || null,
          }));
        }}
      />
      <MutedNote>Audio analysis runs in the web studio.</MutedNote>
    </View>
  );
}

export function StepLyrics({ form, set }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm text-muted-foreground">Paste your lyrics to help the AI find hooks and themes.</Text>
        <Button variant="ghost" size="sm" onPress={() => set("lyrics", "")} className="rounded-full">
          Skip for now
        </Button>
      </View>
      <Textarea value={form.lyrics} onChangeText={(v) => set("lyrics", v)} placeholder="Paste lyrics here…" className="min-h-60 rounded-xl" />
    </View>
  );
}

export function StepGoals({ form, durationDays, set, toggleGoal }) {
  return (
    <View className="gap-5">
      <View>
        <Label className="text-xs text-muted-foreground">Campaign Goals (select one or more)</Label>
        <Text className="mb-3 text-xs text-muted-foreground/70">Goals guide the strategy. They are not guarantees of results.</Text>
        <View className="flex-row flex-wrap gap-2">
          {CAMPAIGN_GOALS.map((g) => (
            <Chip key={g} selected={form.goals.includes(g)} onPress={() => toggleGoal(g)}>
              {g}
            </Chip>
          ))}
        </View>
      </View>
      <Field label="Campaign length">
        <Select
          value={String(durationDays)}
          onValueChange={(v) => set("durationDays", Number(v))}
          title="Campaign length"
          options={CAMPAIGN_DURATIONS.map((d) => ({ value: String(d.days), label: d.label }))}
        />
      </Field>
      <Field label="Campaign start date">
        <Input value={form.startDate} onChangeText={(v) => set("startDate", v)} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      </Field>
    </View>
  );
}

export function StepSummary({ form, durationDays, artists, releases }) {
  const artist =
    form.artistMode === "new" ? { name: form.newArtistName, genre: form.newArtistGenre } : artists.find((a) => a.id === form.artistId);
  const release = form.releaseId ? releases.find((r) => r.id === form.releaseId) : null;
  const rows = [
    ["Artist", artist?.name || "—"],
    ["Release", release?.title || "None"],
    ["Song", form.title],
    ["Genre", form.genre || artist?.genre || "—"],
    ["Release date", fmtDate(form.releaseDate)],
    ["Language", form.language],
    ["Artwork", form.artworkUrl ? "Uploaded" : "Not uploaded"],
    ["Audio", form.audioUri ? "Uploaded" : "Not uploaded"],
    ["Lyrics", form.lyrics ? `${form.lyrics.split("\n").length} lines` : "Skipped"],
    ["Goals", form.goals.length ? form.goals.join(", ") : "None selected"],
    ["Duration", `${durationDays} days`],
    ["Start", fmtDate(form.startDate)],
  ];
  return (
    <View className="gap-4">
      <Text className="text-sm text-muted-foreground">Review your campaign details, then generate. {WEB_RENDER_NOTE}</Text>
      {form.artworkUrl ? <ArtworkImage src={form.artworkUrl} className="h-32 w-32" rounded="rounded-2xl" /> : null}
      <View>
        {rows.map(([k, v], i) => (
          <View key={k} className={cn("flex-row items-center justify-between gap-4 py-2.5", i > 0 && "border-t border-border/40")}>
            <Text className="text-sm text-muted-foreground">{k}</Text>
            <Text className="flex-1 text-right text-sm font-500">{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function GeneratingScreen({ stage }) {
  const colors = useThemeColors();
  return (
    <View className="items-center justify-center py-16">
      <View className="mb-6 h-20 w-20 overflow-hidden rounded-3xl">
        <LinearGradient
          colors={BRAND_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}
        >
          <Icon as={Wand2} size={36} className="text-white" />
        </LinearGradient>
      </View>
      <Text className="text-center font-heading text-xl">Generating your campaign</Text>
      <View className="mt-1.5 flex-row items-center gap-2">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text className="text-sm text-muted-foreground">{stage || "Working…"}</Text>
      </View>
      <Text className="mt-4 max-w-xs text-center text-xs text-muted-foreground/70">
        This usually takes 10–30 seconds. The AI analyzes your song and builds a day-by-day plan.
      </Text>
    </View>
  );
}
