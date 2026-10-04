import { useRef, useState } from "react";
import { CalendarClock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 56;
const MAX_REVEAL = 112;

/**
 * Mobile swipe wrapper: swipe left to reveal Schedule / Post. Desktop renders children only.
 */
export default function SwipeDayCard({
  children,
  onSchedule,
  onPost,
  scheduleLabel = "Schedule",
  postLabel = "Post",
  canSchedule = true,
  className,
}) {
  const startX = useRef(0);
  const dragging = useRef(false);
  const [offset, setOffset] = useState(0);

  const clamp = (v) => Math.max(-MAX_REVEAL, Math.min(0, v));
  const revealed = offset < -8;

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    dragging.current = true;
    startX.current = e.touches[0].clientX - offset;
  };

  const onTouchMove = (e) => {
    if (!dragging.current || e.touches.length !== 1) return;
    const next = clamp(e.touches[0].clientX - startX.current);
    setOffset(next);
  };

  const onTouchEnd = () => {
    dragging.current = false;
    setOffset((o) => (o <= -SWIPE_THRESHOLD ? -MAX_REVEAL : 0));
  };

  const close = () => setOffset(0);

  const actionBtnClass =
    "flex h-[4.25rem] w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] leading-tight";

  return (
    <>
      <div className={cn("relative overflow-hidden rounded-2xl md:hidden", className)}>
        <div
          className={cn(
            "absolute inset-y-0 right-0 z-0 flex w-[7.25rem] items-center justify-end gap-1 pr-1",
            revealed ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={!revealed}
        >
          {canSchedule ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className={actionBtnClass}
              onClick={() => {
                close();
                onSchedule?.();
              }}
            >
              <CalendarClock className="h-4 w-4 shrink-0" />
              <span className="max-w-[3rem] text-center">{scheduleLabel}</span>
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={actionBtnClass}
            onClick={() => {
              close();
              onPost?.();
            }}
          >
            <Share2 className="h-4 w-4 shrink-0" />
            <span className="max-w-[3rem] text-center">{postLabel}</span>
          </Button>
        </div>

        <div
          className="relative z-10 touch-pan-y bg-card transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${offset}px)` }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {children}
        </div>
      </div>
      <div className={cn("hidden md:block", className)}>{children}</div>
    </>
  );
}
