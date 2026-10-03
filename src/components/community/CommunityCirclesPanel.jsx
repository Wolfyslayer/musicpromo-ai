import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Plus, Users } from "lucide-react";
import CommunityFeedPanel from "@/components/community/CommunityFeedPanel";
import EmptyState from "@/components/EmptyState";
import SurfacePanel from "@/components/SurfacePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  createCommunityCircle,
  joinCommunityCircle,
  loadCircleFeed,
  loadCommunityCircles,
} from "@/services/communityService";

export default function CommunityCirclesPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [circles, setCircles] = useState([]);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedItems, setFeedItems] = useState([]);

  const reload = useCallback(() => {
    setLoading(true);
    loadCommunityCircles()
      .then((data) => {
        setCircles(data.circles);
        if (!selectedId && data.circles[0]?.id) setSelectedId(data.circles[0].id);
      })
      .catch((e) => toast({ variant: "destructive", title: "Circles unavailable", description: e.message }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedId) return;
    setFeedLoading(true);
    loadCircleFeed(selectedId)
      .then((data) => setFeedItems(data.items))
      .catch(() => setFeedItems([]))
      .finally(() => setFeedLoading(false));
  }, [selectedId]);

  const onCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await createCommunityCircle(newName.trim());
      toast({ title: "Circle created" });
      setNewName("");
      reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not create", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    if (!joinCode.trim() || busy) return;
    setBusy(true);
    try {
      const res = await joinCommunityCircle(joinCode.trim());
      toast({ title: res.alreadyMember ? "Already a member" : `Joined ${res.name}` });
      setJoinCode("");
      reload();
      if (res.circleId) setSelectedId(res.circleId);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not join", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard
      .writeText(code)
      .then(() => toast({ title: "Invite code copied" }))
      .catch(() => toast({ variant: "destructive", title: "Could not copy" }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SurfacePanel className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Private groups (up to 20 artists) for trusted launch-week coordination. Share the invite code with your crew.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Create circle</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 48))}
                placeholder="Release squad"
                className="rounded-xl"
              />
              <Button type="button" className="shrink-0 rounded-full" disabled={busy} onClick={onCreate}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Join with code</Label>
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCD1234"
                className="rounded-xl font-mono"
              />
              <Button type="button" variant="outline" className="shrink-0 rounded-full" disabled={busy} onClick={onJoin}>
                Join
              </Button>
            </div>
          </div>
        </div>
      </SurfacePanel>

      {!circles.length ? (
        <EmptyState
          icon={Users}
          title="No circles yet"
          description="Create a circle for your label mates or join someone else's invite code."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {circles.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={selectedId === c.id ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setSelectedId(c.id)}
              >
                {c.name} ({c.memberCount}/{c.maxMembers})
              </Button>
            ))}
          </div>
          {selectedId ? (
            <>
              {(() => {
                const c = circles.find((x) => x.id === selectedId);
                if (!c) return null;
                return (
                  <SurfacePanel className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-600">{c.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">Invite: {c.inviteCode}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => copyCode(c.inviteCode)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy code
                    </Button>
                  </SurfacePanel>
                );
              })()}
              <CommunityFeedPanel loading={feedLoading} items={feedItems} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
