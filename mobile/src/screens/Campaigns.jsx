import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react-native";
import { db } from "@/api/db";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { loadCampaigns } from "@/services/data";
import { CAMPAIGN_STATUSES } from "@/services/constants";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Heading } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import CampaignCard from "@/components/CampaignCard";
import EmptyState from "@/components/EmptyState";

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [artist, setArtist] = useState("all");
  const [status, setStatus] = useState("all");
  const [confirm, setConfirm] = useState(null);

  const query = useQuery({
    queryKey: ["campaigns", user?.id],
    queryFn: () => loadCampaigns().catch(() => []),
  });
  const { refetch } = query;
  const reload = useCallback(() => refetch(), [refetch]);
  useWorkspaceRefresh(reload);
  const rows = query.data ?? null;

  const artists = useMemo(() => {
    const map = {};
    (rows || []).forEach((r) => {
      if (r.artist) map[r.artist.id] = r.artist;
    });
    return Object.values(map);
  }, [rows]);

  const filtered = (rows || []).filter((c) => {
    const needle = q.toLowerCase();
    const matchQ =
      !q || (c.song?.title || "").toLowerCase().includes(needle) || (c.artist?.name || "").toLowerCase().includes(needle);
    const matchArtist = artist === "all" || c.artist_id === artist;
    const matchStatus = status === "all" || c.status === status;
    return matchQ && matchArtist && matchStatus;
  });

  const remove = async (c) => {
    try {
      await db.entities.CampaignDay.deleteMany({ campaign_id: c.id });
      await db.entities.Campaign.delete(c.id);
      setConfirm(null);
      toast({ title: "Campaign deleted" });
      reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not delete campaign", description: e?.message });
    }
  };

  return (
    <Screen refreshing={query.isRefetching} onRefresh={reload}>
      <View className="flex-row items-center justify-between gap-3">
        <Heading>Campaigns</Heading>
        <Button icon={Plus} onPress={() => router.push("/create")} className="rounded-full">
          New
        </Button>
      </View>

      <View className="gap-2">
        <View className="justify-center">
          <Input value={q} onChangeText={setQ} placeholder="Search song or artist…" className="pl-9" autoCorrect={false} />
          <View pointerEvents="none" className="absolute left-3">
            <Icon as={Search} size={16} className="text-muted-foreground" />
          </View>
        </View>
        <View className="flex-row gap-2">
          <Select
            className="flex-1"
            value={artist}
            onValueChange={setArtist}
            title="Artist"
            options={[{ value: "all", label: "All artists" }, ...artists.map((a) => ({ value: a.id, label: a.name }))]}
          />
          <Select
            className="flex-1"
            value={status}
            onValueChange={setStatus}
            title="Status"
            options={[{ value: "all", label: "All statuses" }, ...CAMPAIGN_STATUSES.map((s) => ({ value: s.id, label: s.label }))]}
          />
        </View>
      </View>

      {filtered.length ? (
        <View className="gap-3">
          {filtered.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              song={c.song}
              artist={c.artist}
              daysCount={c.daysCount}
              videosCount={c.videosCount}
              onAction={(camp) => setConfirm({ camp, type: "menu" })}
            />
          ))}
        </View>
      ) : rows ? (
        <EmptyState icon={Search} title="No campaigns found" description="Try a different search or create a new campaign." />
      ) : (
        <View className="h-40 rounded-2xl bg-muted/40" />
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this campaign?"
        description="This removes the campaign and its day-by-day plan. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirm && remove(confirm.camp)}
      />
    </Screen>
  );
}
