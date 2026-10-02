import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Artwork, Button, Field, Screen, SelectField } from "@/components/ui";
import { RELEASE_STATUSES } from "@/lib/constants";
import { loadArtists } from "@/lib/data";
import { db } from "@/lib/db";
import { errorMessage, todayISO } from "@/lib/format";
import { uploadPromoAsset } from "@/lib/store";
import type { Row } from "@/lib/types";

export function ReleaseForm({ releaseId }: { releaseId?: string }) {
  const isNew = !releaseId;
  const router = useRouter();
  const { toast } = useToast();
  const { requireAuth } = useAuth();
  const [artists, setArtists] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    artist_id: "",
    release_date: todayISO(),
    status: "draft",
    artwork_url: "",
    description: "",
    presave_url: "",
  });

  useEffect(() => {
    loadArtists().then(setArtists).catch(() => setArtists([]));
  }, []);

  useEffect(() => {
    if (!releaseId) return;
    db.entities.Release.get(releaseId)
      .then((release) =>
        setForm({
          title: release.title || "",
          artist_id: release.artist_id || "",
          release_date: release.release_date || todayISO(),
          status: release.status || "draft",
          artwork_url: release.artwork_url || "",
          description: release.description || "",
          presave_url: release.presave_url || "",
        })
      )
      .catch(() => router.replace("/releases"));
  }, [releaseId, router]);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const pickArtwork = async () => {
    if (!requireAuth()) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const uploaded = await uploadPromoAsset(
      { uri: asset.uri, name: asset.fileName || "cover.jpg", type: asset.mimeType || "image/jpeg" },
      "artwork"
    );
    set("artwork_url", uploaded.file_url);
  };

  const save = async () => {
    if (!requireAuth()) return;
    if (!form.title.trim() || !form.artist_id) {
      toast({ title: "Title and artist are required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, title: form.title.trim(), is_demo: false };
      if (isNew) {
        const created = await db.entities.Release.create(payload);
        toast({ title: "Release created" });
        router.replace(`/releases/${created.id}`);
      } else {
        await db.entities.Release.update(releaseId, payload);
        toast({ title: "Release saved" });
        router.replace(`/releases/${releaseId}`);
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
          <Artwork uri={form.artwork_url} size={88} />
          <Button label="Choose artwork" variant="outline" onPress={pickArtwork} />
        </View>
        <Field label="Title" value={form.title} onChangeText={(value) => set("title", value)} autoCapitalize="words" />
        <SelectField
          label="Artist"
          value={form.artist_id}
          onChange={(value) => set("artist_id", value)}
          options={artists.map((artist) => ({ label: artist.name, value: artist.id }))}
          placeholder="Select artist"
        />
        <Field label="Release date" value={form.release_date} onChangeText={(value) => set("release_date", value)} placeholder="YYYY-MM-DD" />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(value) => set("status", value)}
          options={RELEASE_STATUSES.map((status) => ({ label: status.label, value: status.id }))}
        />
        <Field label="Description" value={form.description} onChangeText={(value) => set("description", value)} multiline autoCapitalize="sentences" />
        <Field label="Pre-save URL" value={form.presave_url} onChangeText={(value) => set("presave_url", value)} placeholder="https://" />
        <Button label={isNew ? "Create release" : "Save release"} onPress={save} loading={busy} />
      </View>
    </Screen>
  );
}
