import { useState } from "react";
import { Captions, Clapperboard } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function VideoTypeModal({ open, onOpenChange, onConfirm }) {
  const [seconds, setSeconds] = useState(15);

  const choose = (videoType) => {
    onConfirm?.({
      videoType,
      seconds: videoType === "promo" ? seconds : 0,
    });
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-border bg-background p-5 text-foreground sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Choose a video type</DialogTitle>
          <DialogDescription>
            This sets the timeline length, the lyric sync workspace, and whether the promo hook plays.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-border bg-card p-4">
            <Captions className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-heading text-base font-semibold">Full Lyrics Video</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              Uses the whole track, opens the auto-sync timeline, and leaves the marketing intro off.
            </p>
            <Button type="button" className="mt-4 min-h-11 w-full rounded-full" onClick={() => choose("lyrics")}>
              Start lyrics video
            </Button>
          </article>
          <article className="flex flex-col rounded-2xl border border-primary/40 bg-primary/10 p-4">
            <Clapperboard className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-heading text-base font-semibold">Short Promo / Teaser Reel</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              A 15s or 30s cut with the audio trimmer, a 3-second intro hook, and an outro button.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[15, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSeconds(value)}
                  className={`min-h-11 rounded-xl border text-sm font-600 ${
                    seconds === value
                      ? "border-primary bg-background text-primary"
                      : "border-border bg-background/70 text-foreground"
                  }`}
                >
                  {value}s
                </button>
              ))}
            </div>
            <Button type="button" className="mt-4 min-h-11 w-full rounded-full" onClick={() => choose("promo")}>
              Start {seconds}s teaser
            </Button>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
