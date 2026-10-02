import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/api/db";
import { loadArtists } from "@/services/data";
import { RELEASE_STATUSES } from "@/services/constants";
import { todayISO } from "@/services/format";
import { useAuth } from "@/lib/AuthContext";
import { ErrorState, LoadingState, PageHeader, Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import ArtworkUpload from "@/components/ArtworkUpload";

function initialForm(r) {
  return {
    title: r?.title || "",
    artist_id: r?.artist_id || "",
    release_date: r?.release_date || todayISO(),
    status: r?.status || "draft",
    artwork_url: r?.artwork_url || "",
    description: r?.description || "",
    presave_url: r?.presave_url || "",
  };
}

export default function ReleaseEditor() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const isNew = !id || id === "new";
  const releaseId = isNew ? null : id;

  const releaseQuery = useQuery({
    queryKey: ["release-record", releaseId, user?.id],
    queryFn: () => db.entities.Release.get(releaseId),
    enabled: Boolean(releaseId),
  });
  const artistsQuery = useQuery({
    queryKey: ["artists", user?.id],
    queryFn: () => loadArtists().catch(() => []),
  });

  if (releaseId && releaseQuery.isError) {
    return (
      <Screen>
        <ErrorState title="Release not found" message={releaseQuery.error?.message} onRetry={() => releaseQuery.refetch()} />
        <Button variant="ghost" onPress={() => router.replace("/releases")}>
          Back to releases
        </Button>
      </Screen>
    );
  }

  if (releaseId && !releaseQuery.data) return <LoadingState />;

  return (
    <ReleaseForm
      key={releaseId || "new"}
      isNew={isNew}
      releaseId={releaseId}
      release={releaseQuery.data}
      artists={artistsQuery.data || []}
    />
  );
}

function ReleaseForm({ isNew, releaseId, release, artists }) {
  const { requireAuth } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => initialForm(release));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title?.trim()) {
      toast({ variant: "destructive", title: "Title required" });
      return;
    }
    if (!form.artist_id) {
      toast({ variant: "destructive", title: "Artist required" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        artist_id: form.artist_id,
        release_date: form.release_date || null,
        status: form.status || "draft",
        artwork_url: form.artwork_url || "",
        description: form.description || "",
        presave_url: form.presave_url || "",
        is_demo: false,
      };
      if (isNew) {
        const created = await db.entities.Release.create(payload);
        toast({ title: "Release created" });
        queryClient.invalidateQueries({ queryKey: ["releases"] });
        router.replace(`/releases/${created.id}`);
      } else {
        await db.entities.Release.update(releaseId, payload);
        toast({ title: "Release saved" });
        queryClient.invalidateQueries({ queryKey: ["releases"] });
        queryClient.invalidateQueries({ queryKey: ["release", releaseId] });
        queryClient.invalidateQueries({ queryKey: ["release-record", releaseId] });
        if (router.canGoBack()) router.back();
        else router.replace(`/releases/${releaseId}`);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader title={isNew ? "New Release" : "Edit Release"} />

      <View className="gap-5 rounded-2xl border border-border/60 bg-card p-5">
        <View className="gap-2">
          <Label className="text-xs text-muted-foreground">Artwork</Label>
          <ArtworkUpload
            guard={requireAuth}
            value={form.artwork_url}
            onChange={(payload) => set("artwork_url", typeof payload === "string" ? payload : payload?.url || "")}
          />
        </View>

        <Field label="Release Title *">
          <Input value={form.title} onChangeText={(v) => set("title", v)} placeholder="e.g. Vad lämnar vi efter oss?" />
        </Field>

        <Field label="Artist *">
          <Select
            value={form.artist_id}
            onValueChange={(v) => set("artist_id", v)}
            placeholder="Select artist"
            title="Artist"
            options={artists.map((a) => ({ value: a.id, label: a.name }))}
          />
        </Field>
        <Field label="Release Date">
          <Input
            value={form.release_date}
            onChangeText={(v) => set("release_date", v)}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        </Field>
        <Field label="Status">
          <Select
            value={form.status}
            onValueChange={(v) => set("status", v)}
            title="Status"
            options={RELEASE_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
          />
        </Field>
        <Field label="Pre-save URL (optional)">
          <Input
            value={form.presave_url}
            onChangeText={(v) => set("presave_url", v)}
            placeholder="https://"
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <Field label="Description (optional)">
          <Textarea value={form.description} onChangeText={(v) => set("description", v)} placeholder="Short release notes…" />
        </Field>

        <Button onPress={save} loading={busy} className="rounded-full">
          {busy ? "Saving…" : isNew ? "Create Release" : "Save Release"}
        </Button>
      </View>
    </Screen>
  );
}
