import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";
import { db } from "@/api/db";
import { GENRES } from "@/services/constants";
import { uploadPromoAsset } from "@/services/supabaseStore";
import { useAuth } from "@/lib/AuthContext";
import { useThemeColors } from "@/lib/theme";
import { ErrorState, LoadingState, PageHeader, Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import ArtworkImage from "@/components/ArtworkImage";

const FIELDS = [
  { key: "spotify_url", label: "Spotify URL" },
  { key: "youtube_url", label: "YouTube URL" },
  { key: "tiktok_url", label: "TikTok URL" },
  { key: "instagram_url", label: "Instagram URL" },
  { key: "facebook_url", label: "Facebook URL" },
];

const EMPTY = {
  name: "",
  profile_image: "",
  biography: "",
  genre: "",
  location: "",
  website: "",
  spotify_url: "",
  youtube_url: "",
  tiktok_url: "",
  instagram_url: "",
  facebook_url: "",
};

export default function ArtistEditor() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const isNew = !id || id === "new";

  const query = useQuery({
    queryKey: ["artist", id, user?.id],
    queryFn: () => db.entities.Artist.get(id),
    enabled: !isNew,
  });

  if (!isNew && query.isError) {
    return (
      <Screen>
        <ErrorState title="Artist not found" message={query.error?.message} onRetry={() => query.refetch()} />
        <Button variant="ghost" onPress={() => router.replace("/artists")}>
          Back to artists
        </Button>
      </Screen>
    );
  }

  if (!isNew && !query.data) return <LoadingState />;

  return <ArtistForm key={isNew ? "new" : id} id={id} isNew={isNew} artist={query.data} />;
}

function ArtistForm({ id, isNew, artist }) {
  const { requireAuth } = useAuth();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(artist || {}) }));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const { publicUrl } = await uploadPromoAsset(
        { uri: asset.uri, name: asset.fileName || `artist-${Date.now()}.jpg`, mimeType: asset.mimeType || "image/jpeg" },
        "artists"
      );
      set("profile_image", publicUrl);
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally {
      setUploading(false);
    }
  };

  const openPicker = () => requireAuth(pickImage);

  const save = async () => {
    if (!form.name?.trim()) {
      toast({ variant: "destructive", title: "Name required" });
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        const created = await db.entities.Artist.create({ ...form, is_demo: false });
        toast({ title: "Artist created" });
        queryClient.invalidateQueries({ queryKey: ["artists"] });
        router.replace(`/artists/${created.id}`);
      } else {
        await db.entities.Artist.update(id, form);
        toast({ title: "Artist saved" });
        queryClient.invalidateQueries({ queryKey: ["artists"] });
        queryClient.invalidateQueries({ queryKey: ["artist", id] });
        goBack();
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/artists");
  };

  return (
    <Screen>
      <PageHeader title={isNew ? "New Artist" : "Edit Artist"} />

      <View className="gap-5 rounded-2xl border border-border/60 bg-card p-5">
        <View className="flex-row items-center gap-4">
          {form.profile_image ? (
            <View>
              <ArtworkImage src={form.profile_image} className="h-20 w-20" rounded="rounded-full" />
              <Pressable
                onPress={() => set("profile_image", "")}
                hitSlop={8}
                accessibilityLabel="Remove profile image"
                className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-destructive"
              >
                <Icon as={X} size={14} className="text-destructive-foreground" />
              </Pressable>
              {uploading ? (
                <View className="absolute inset-0 items-center justify-center rounded-full bg-black/50">
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={openPicker}
              disabled={uploading}
              accessibilityLabel="Upload profile image"
              className="h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-border/70 bg-muted/30 active:border-primary/50"
            >
              {uploading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Icon as={ImagePlus} size={24} className="text-muted-foreground" />
              )}
            </Pressable>
          )}
          <View className="flex-1">
            <Text className="text-sm font-600">Profile image</Text>
            <Text className="text-xs text-muted-foreground">JPG / PNG / WEBP — stored publicly.</Text>
            {form.profile_image ? (
              <Pressable onPress={openPicker} disabled={uploading} hitSlop={8} className="mt-1 self-start">
                <Text className="text-xs text-primary">Replace</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Field label="Artist Name *">
          <Input value={form.name || ""} onChangeText={(v) => set("name", v)} placeholder="e.g. Aurora Vale" />
        </Field>
        <Field label="Genre">
          <Select value={form.genre || ""} onValueChange={(v) => set("genre", v)} placeholder="Select genre" title="Genre" options={GENRES} />
        </Field>
        <Field label="Location">
          <Input value={form.location || ""} onChangeText={(v) => set("location", v)} placeholder="e.g. Stockholm, SE" />
        </Field>
        <Field label="Website">
          <Input
            value={form.website || ""}
            onChangeText={(v) => set("website", v)}
            placeholder="https://"
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <Field label="Biography">
          <Textarea value={form.biography || ""} onChangeText={(v) => set("biography", v)} placeholder="Short bio…" className="min-h-28" />
        </Field>

        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <Input
              value={form[f.key] || ""}
              onChangeText={(v) => set(f.key, v)}
              placeholder="https://"
              autoCapitalize="none"
              keyboardType="url"
            />
          </Field>
        ))}

        <View className="flex-row justify-end gap-2">
          <Button variant="ghost" onPress={goBack}>
            Cancel
          </Button>
          <Button onPress={save} loading={busy} className="rounded-full">
            {isNew ? "Create Artist" : "Save"}
          </Button>
        </View>
      </View>
    </Screen>
  );
}
