import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Artwork, Button, Field, Muted, Screen, SelectField } from "@/components/ui";
import { GENRES } from "@/lib/constants";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";
import { uploadPromoAsset } from "@/lib/store";

const LINKS = [
  ["website", "Website"],
  ["spotify_url", "Spotify URL"],
  ["youtube_url", "YouTube URL"],
  ["tiktok_url", "TikTok URL"],
  ["instagram_url", "Instagram URL"],
  ["facebook_url", "Facebook URL"],
] as const;

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const { toast } = useToast();
  const { requireAuth } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew || !id) return;
    db.entities.Artist.get(String(id))
      .then((artist) => setForm((current) => ({ ...current, ...artist })))
      .catch(() => router.replace("/artists"));
  }, [id, isNew, router]);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const pickImage = async () => {
    if (!requireAuth()) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const uploaded = await uploadPromoAsset(
        { uri: asset.uri, name: asset.fileName || "profile.jpg", type: asset.mimeType || "image/jpeg" },
        "artwork"
      );
      set("profile_image", uploaded.file_url);
    } catch (err) {
      toast({ title: "Upload failed", description: errorMessage(err), variant: "destructive" });
    }
  };

  const save = async () => {
    if (!requireAuth()) return;
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        const created = await db.entities.Artist.create({ ...form, is_demo: false });
        toast({ title: "Artist created" });
        router.replace(`/artists/${created.id}`);
      } else {
        await db.entities.Artist.update(String(id), form);
        toast({ title: "Artist saved" });
        router.replace("/artists");
      }
    } catch (err) {
      toast({ title: "Save failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="gap-4">
        <View className="flex-row items-center gap-3">
          <Artwork uri={form.profile_image} size={80} />
          <View className="flex-1 gap-2">
            <Muted>Profile image</Muted>
            <Button label="Choose photo" variant="outline" onPress={pickImage} />
          </View>
        </View>
        <Field label="Artist name" value={form.name} onChangeText={(value) => set("name", value)} autoCapitalize="words" />
        <SelectField label="Genre" value={form.genre} onChange={(value) => set("genre", value)} options={GENRES.map((genre) => ({ label: genre, value: genre }))} />
        <Field label="Location" value={form.location} onChangeText={(value) => set("location", value)} autoCapitalize="words" />
        <Field label="Biography" value={form.biography} onChangeText={(value) => set("biography", value)} multiline autoCapitalize="sentences" />
        {LINKS.map(([key, label]) => (
          <Field key={key} label={label} value={form[key]} onChangeText={(value) => set(key, value)} placeholder="https://" />
        ))}
        <Button label={isNew ? "Create artist" : "Save"} onPress={save} loading={busy} />
      </View>
    </Screen>
  );
}