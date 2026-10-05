import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import { deleteCampaign, loadCampaigns } from "@/services/data";
import { CAMPAIGN_STATUSES } from "@/services/constants";
import CampaignCard from "@/components/CampaignCard";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
export default function Campaigns() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [artist, setArtist] = useState("all");
  const [status, setStatus] = useState("all");
  const [confirm, setConfirm] = useState(null);

  const reload = () => loadCampaigns().then(setRows).catch(() => setRows([]));
  useEffect(() => { reload(); }, []);

  const artists = useMemo(() => {
    const map = {};
    (rows || []).forEach((r) => { if (r.artist) map[r.artist.id] = r.artist; });
    return Object.values(map);
  }, [rows]);

  const filtered = (rows || []).filter((c) => {
    const matchQ = !q || (c.song?.title || "").toLowerCase().includes(q.toLowerCase()) || (c.artist?.name || "").toLowerCase().includes(q.toLowerCase());
    const matchArtist = artist === "all" || c.artist_id === artist;
    const matchStatus = status === "all" || c.status === status;
    return matchQ && matchArtist && matchStatus;
  });

  const remove = async (c) => {
    try {
      await deleteCampaign(c.id);
      setConfirm(null);
      toast({ title: "Campaign deleted", description: "Queued auto-publish posts were cancelled." });
      reload();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not delete campaign",
        description: e?.message || "Try again after redeploying campaignCancelAutoPublish.",
      });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Library"
        title="Campaigns"
        description="Search, filter, and open any release plan."
        actions={
          <Button onClick={() => navigate("/create")} className="rounded-full">
            <Plus className="mr-1.5 h-4 w-4" /> New campaign
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search song or artist…" className="rounded-xl pl-9" />
        </div>
        <Select value={artist} onValueChange={setArtist}>
          <SelectTrigger className="w-full rounded-xl sm:w-44"><Filter className="mr-1.5 h-4 w-4" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All artists</SelectItem>
            {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full rounded-xl sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CAMPAIGN_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} song={c.song} artist={c.artist} daysCount={c.daysCount} videosCount={c.videosCount}
              onAction={(camp) => setConfirm({ camp, type: "menu" })}
            />
          ))}
        </div>
      ) : rows ? (
        <EmptyState icon={Search} title="No campaigns found" description="Try a different search or create a new campaign." />
      ) : (
        <div className="h-40 animate-shimmer rounded-2xl" />
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this campaign?"
        description="This removes the campaign and its day-by-day plan and cancels any queued auto-publish. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirm && remove(confirm.camp)}
      />
    </div>
  );
}
