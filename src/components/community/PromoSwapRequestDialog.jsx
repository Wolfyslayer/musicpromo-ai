import { useState } from "react";
import { Handshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { createPromoSwapRequest } from "@/services/communityService";

export default function PromoSwapRequestDialog({ targetUserId, displayName, campaignId = null }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!targetUserId || busy) return;
    setBusy(true);
    try {
      await createPromoSwapRequest(targetUserId, message.trim(), campaignId);
      toast({
        title: "Promo swap request sent",
        description: `${displayName || "The artist"} can accept from their Community inbox.`,
      });
      setOpen(false);
      setMessage("");
    } catch (e) {
      toast({ variant: "destructive", title: "Could not send", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="rounded-full">
          <Handshake className="mr-1.5 h-3.5 w-3.5" />
          Request promo swap
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Promo swap request</DialogTitle>
          <DialogDescription>
            Propose a mutual launch-week shout-out with {displayName || "this artist"}. They will see this in Community →
            Inbox.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Your pitch</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            rows={4}
            className="rounded-xl"
            placeholder="We both drop Friday — want to swap Story posts and tag each other?"
          />
          <p className="text-xs text-muted-foreground">At least 10 characters.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" disabled={busy || message.trim().length < 10} onClick={submit}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
