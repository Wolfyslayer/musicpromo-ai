import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Loader2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import SurfacePanel from "@/components/SurfacePanel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { loadPromoSwapRequests, respondPromoSwapRequest } from "@/services/communityService";
import { formatHandleLabel, profilePublicPath } from "@/services/profileHandle";

export default function CommunityInboxPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    loadPromoSwapRequests()
      .then((data) => {
        setIncoming(data.incoming);
        setOutgoing(data.outgoing);
      })
      .catch((e) => toast({ variant: "destructive", title: "Inbox unavailable", description: e.message }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const act = async (requestId, action) => {
    setBusyId(requestId);
    try {
      await respondPromoSwapRequest(requestId, action);
      toast({ title: action === "accept" ? "Accepted" : action === "decline" ? "Declined" : "Cancelled" });
      reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not update", description: e.message });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const empty = !incoming.length && !outgoing.length;

  if (empty) {
    return (
      <EmptyState
        icon={Inbox}
        title="Inbox is empty"
        description="Promo swap requests you send or receive will show up here."
      />
    );
  }

  return (
    <div className="space-y-6">
      {incoming.length ? (
        <section className="space-y-2">
          <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Incoming</h2>
          {incoming.map((r) => (
            <SurfacePanel key={r.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link to={profilePublicPath(r.requester)} className="font-600 hover:text-primary">
                    {r.requester?.displayName || "Artist"}
                  </Link>
                  {r.requester?.handle ? (
                    <p className="text-xs text-muted-foreground">{formatHandleLabel(r.requester.handle)}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">{r.message}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{r.status}</p>
                </div>
                {r.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "accept")}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "decline")}
                    >
                      Decline
                    </Button>
                  </div>
                ) : null}
              </div>
            </SurfacePanel>
          ))}
        </section>
      ) : null}

      {outgoing.length ? (
        <section className="space-y-2">
          <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Sent</h2>
          {outgoing.map((r) => (
            <SurfacePanel key={r.id} className="space-y-2">
              <p className="text-sm">
                To{" "}
                <Link to={profilePublicPath(r.target)} className="font-600 hover:text-primary">
                  {r.target?.displayName || "Artist"}
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">{r.message}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.status}</p>
              {r.status === "pending" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  disabled={busyId === r.id}
                  onClick={() => act(r.id, "cancel")}
                >
                  Cancel request
                </Button>
              ) : null}
            </SurfacePanel>
          ))}
        </section>
      ) : null}
    </div>
  );
}
