import { useRef, useState } from "react";
import { CalendarClock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 56;
const MAX_REVEAL = 120;

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

  return (
    <>
      <div className={cn("relative md:hidden", className)}>
        <div className="absolute inset-y-0 right-0 flex items-stretch gap-1 pr-1">
          {canSchedule ? (
            <Button
              type="button"
              size="sm"
              className="h-auto min-w-[4.5rem] rounded-xl px-2 text-xs"
              onClick={() => {
                close();
                onSchedule?.();
              }}
            >
              <CalendarClock className="mb-0.5 h-4 w-4" />
              {scheduleLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-auto min-w-[4.5rem] rounded-xl px-2 text-xs"
            onClick={() => {
              close();
              onPost?.();
            }}
          >
            <Share2 className="mb-0.5 h-4 w-4" />
            {postLabel}
          </Button>
        </div>

        <div
          className="relative touch-pan-y transition-transform duration-200 ease-out"
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
