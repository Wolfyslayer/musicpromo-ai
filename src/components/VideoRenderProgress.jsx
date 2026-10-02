import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

/**
 * Visual progress for client-side Remotion / WebCodecs rendering.
 */
export default function VideoRenderProgress({
  progress = 0,
  message = "Rendering…",
  title = "Rendering promo video",
  hint = "This runs on your device — no server render cost.",
}) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <div className="w-full max-w-md space-y-4 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
      <div>
        <h3 className="font-heading text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {message}
        </p>
      </div>
      <div className="space-y-2 px-1 text-left">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Device encode</span>
          <span className="tabular-nums font-500 text-foreground">{value}%</span>
        </div>
        <Progress value={value} className="h-2.5" />
      </div>
      {hint ? <p className="text-xs text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}
