import { useRef, useState } from "react";
import { normalizeEditorLook } from "@/remotion/styles";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Transparent handles over the 9:16 preview. Positions commit into editor_look
 * on release so the preview canvas stays off the audio clock while the pointer moves.
 */
export default function PreviewDragLayer({ look, onLook, onDragging }) {
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const frameRefId = useRef(0);
  const [live, setLive] = useState(null);
  const placed = live || normalizeEditorLook(look);

  const pointFromEvent = (event) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const commit = (kind, x, y) => {
    if (kind === "lyric") {
      onLook?.({
        lyricX: Math.round(clamp(x, 8, 92) * 10) / 10,
        lyricY: Math.round(clamp(y, 8, 92) * 10) / 10,
      });
      return;
    }
    onLook?.({
      particleX: Math.round(clamp(x, 0, 100) * 10) / 10,
      particleY: Math.round(clamp(y, 0, 100) * 10) / 10,
    });
  };

  const schedule = (kind, x, y) => {
    dragRef.current = { ...(dragRef.current || {}), kind, x, y };
    if (frameRefId.current) return;
    frameRefId.current = requestAnimationFrame(() => {
      frameRefId.current = 0;
      const current = dragRef.current;
      if (!current) return;
      setLive((previous) => {
        const base = previous || normalizeEditorLook(look);
        if (current.kind === "lyric") {
          return {
            ...base,
            lyricX: Math.round(clamp(current.x, 8, 92) * 10) / 10,
            lyricY: Math.round(clamp(current.y, 8, 92) * 10) / 10,
          };
        }
        return {
          ...base,
          particleX: Math.round(clamp(current.x, 0, 100) * 10) / 10,
          particleY: Math.round(clamp(current.y, 0, 100) * 10) / 10,
        };
      });
    });
  };

  const onPointerDown = (kind) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic events have no pointer to capture */
    }
    const point = pointFromEvent(event);
    if (!point) return;
    dragRef.current = { kind, pointerId: event.pointerId, x: point.x, y: point.y };
    onDragging?.(true);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    if (!point) return;
    schedule(drag.kind, point.x, point.y);
  };

  const finish = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event) || drag;
    dragRef.current = null;
    if (frameRefId.current) {
      cancelAnimationFrame(frameRefId.current);
      frameRefId.current = 0;
    }
    commit(drag.kind, point.x, point.y);
    setLive(null);
    onDragging?.(false);
  };

  return (
    <div
      ref={frameRef}
      className="pointer-events-none absolute inset-0 z-10"
    >
      <button
        type="button"
        aria-label="Drag particle source"
        onPointerDown={onPointerDown("particle")}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 bg-transparent p-6"
        style={{ left: `${placed.particleX}%`, top: `${placed.particleY}%`, touchAction: "none" }}
      >
        <span className="grid h-11 w-11 place-items-center rounded-full border border-amber-200/80 bg-amber-400/25 shadow-[0_0_18px_rgba(251,191,36,0.45)]">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-200" />
        </span>
      </button>
      <button
        type="button"
        aria-label="Drag lyric text"
        onPointerDown={onPointerDown("lyric")}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 bg-transparent p-6"
        style={{ left: `${placed.lyricX}%`, top: `${placed.lyricY}%`, touchAction: "none" }}
      >
        <span className="grid min-h-11 min-w-11 place-items-center rounded-full border border-primary/70 bg-primary/30 px-3 text-[10px] font-semibold uppercase tracking-wide text-white shadow-[0_0_18px_hsl(var(--primary)/0.45)]">
          Lyrics
        </span>
      </button>
    </div>
  );
}
