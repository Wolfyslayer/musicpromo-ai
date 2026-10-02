import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Artwork, Badge, Button, Card, Empty, Field, Muted, P, Screen, SelectField } from "@/components/ui";
import { CAMPAIGN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { loadCampaigns } from "@/lib/data";
import { errorMessage } from "@/lib/format";
import type { Row } from "@/lib/types";

export default function Campaigns() {
  const router = useRouter();
  const { toast } = useToast();
  const { refreshKey } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");
  const [artist, setArtist] = useState("all");
  const [status, setStatus] = useState("all");

  const reload = useCallback(() => {
    loadCampaigns().then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const artists = useMemo(() => {
    const map: Record<string, Row> = {};
    (rows || []).forEach((row) => {
      if (row.artist) map[row.artist.id] = row.artist;
    });
    return Object.values(map);
  }, [rows]);

  const filtered = (rows || []).filter((campaign) => {
    const haystack = `${campaign.song?.title || ""} ${campaign.artist?.name || ""}`.toLowerCase();
    const matchQuery = !query || haystack.includes(query.toLowerCase());
    const matchArtist = artist === "all" || campaign.artist_id === artist;
    const matchStatus = status === "all" || campaign.status === status;
    return matchQuery && matchArtist && matchStatus;
  });

  const duplicate = async (campaign: Row) => {
    try {
      await db.entities.Campaign.create({
        song_id: campaign.song_id,
        artist_id: campaign.artist_id,
        release_id: campaign.release_id,
        name: `${campaign.name || "Campaign"} (copy)`,
        status: "draft",
        duration_days: campaign.duration_days,
        goals: campaign.goals || [],
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        summary: campaign.summary,
        is_demo: false,
      });
      toast({ title: "Campaign duplicated" });
      reload();
    } catch (err) {
      toast({ title: "Duplicate failed", description: errorMessage(err), variant: "destructive" });
    }
  };

  const archive = async (campaign: Row) => {
    await db.entities.Campaign.update(campaign.id, { status: "archived" });
    toast({ title: "Campaign archived" });
    reload();
  };

  const remove = (campaign: Row) => {
    Alert.alert("Delete campaign", "This removes the campaign and its days.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await db.entities.CampaignDay.deleteMany({ campaign_id: campaign.id });
          await db.entities.Campaign.delete(campaign.id);
          toast({ title: "Campaign deleted" });
          reload();
        },
      },
    ]);
  };

  return (
    <Screen>
      <View className="gap-4">
        <Button label="New campaign" onPress={() => router.push("/create")} />
        <Field label="Search" value={query} onChangeText={setQuery} placeholder="Song or artist" />
        <SelectField
          label="Artist"
          value={artist}
          onChange={setArtist}
          options={[{ label: "All artists", value: "all" }, ...artists.map((item) => ({ label: item.name, value: item.id }))]}
        />
        <SelectField
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ label: "All statuses", value: "all" }, ...CAMPAIGN_STATUSES.map((item) => ({ label: item.label, value: item.id }))]}
        />
        {filtered.length ? (
          filtered.map((campaign) => (
            <Card key={campaign.id} className="gap-3">
              <Pressable className="flex-row gap-3" onPress={() => router.push(`/campaigns/${campaign.id}`)}>
                <Artwork uri={campaign.song?.artwork_url} size={64} />
                <View className="flex-1 gap-1">
                  <P className="font-semibold">{campaign.song?.title || campaign.name || "Untitled"}</P>
                  <Muted>{campaign.artist?.name}</Muted>
                  <Badge status={campaign.status} />
                  <Muted>
                    {campaign.daysCount || 0} days · {campaign.videosCount || 0} videos · {campaign.progressValue || 0}%
                  </Muted>
                </View>
              </Pressable>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button label="Copy" variant="outline" onPress={() => duplicate(campaign)} />
                </View>
                <View className="flex-1">
                  <Button label="Archive" variant="ghost" onPress={() => archive(campaign)} />
                </View>
                <View className="flex-1">
                  <Button label="Delete" variant="destructive" onPress={() => remove(campaign)} />
                </View>
              </View>
            </Card>
          ))
        ) : rows ? (
          <Empty title="No campaigns" description="Create one from a song, or adjust the filters." />
        ) : null}
      </View>
    </Screen>
  );
}
