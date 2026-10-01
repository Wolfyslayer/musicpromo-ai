import { useEffect, useMemo, useRef, useState } from "react";
import { PARTICLE_EFFECTS, clampAudioOffset, cuesInAudioWindow, formatClock, normalizeParticleEffect } from "@/remotion/styles";
import { loadAudioProfile } from "@/services/waveform";

function effectLabel(id) {
  const effect = normalizeParticleEffect(id);
  return PARTICLE_EFFECTS.find((item) => item.id === effect)?.label || "Effect";
}

/**
 * CapCut-style dock: waveform, lyric clips, and the active effect window.
 * The playhead is positioned from the player without re-rendering the studio.
 */
export default function MultiTrackTimeline({
  duration = 15,
  audioUrl = "",
  cues = [],
  effect = "none",
  playheadRef,
  onSeek,
  onCueMove,
  onScrubbing,
  audioOffset = 0,
  onAudioOffset,
  onDragging,
  onAudioDuration,
}) {
  const waveRef = useRef(null);
  const dockRef = useRef(null);
  const scrubbing = useRef(false);
  const clipDrag = useRef(null);
  const trimDrag = useRef(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [liveOffset, setLiveOffset] = useState(null);
  const shownOffset = liveOffset == null ? audioOffset : liveOffset;

  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let cancelled = false;
    const paint = (peaks) => {
      if (cancelled || !ctx) return;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(168, 85, 247, 0.9)";
      const mid = height / 2;
      const count = peaks?.length || 0;
      if (!count) return;
      for (let i = 0; i < count; i += 1) {
        const amp = Math.max(1, peaks[i] * (mid - 2));
        const x = (i / count) * width;
        ctx.fillRect(x, mid - amp, Math.max(1, width / count - 0.5), amp * 2);
      }
    };
    if (!audioUrl) {
      paint(null);
      return undefined;
    }
    loadAudioProfile(audioUrl)
      .then((profile) => {
        if (cancelled) return;
        setAudioDuration(profile.duration || 0);
        onAudioDuration?.(profile.duration || 0);
        paint(profile.peaks);
      })
      .catch(() => paint(null));
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  const timeAt = (event) => {
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect?.width) return 0;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const seek = (event) => {
    const time = timeAt(event);
    if (playheadRef?.current) playheadRef.current.style.left = `${(time / Math.max(0.001, duration)) * 100}%`;
    onSeek?.(time);
  };

  const onScrubDown = (event) => {
    if (event.target?.closest?.("[data-clip],[data-trim]")) return;
    scrubbing.current = true;
    onScrubbing?.(true);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* synthetic events have no pointer to capture */
    }
    seek(event);
  };

  const onScrubMove = (event) => {
    if (!scrubbing.current) return;
    seek(event);
  };

  const onScrubUp = () => {
    scrubbing.current = false;
    onScrubbing?.(false);
  };

  const onClipDown = (index, cue) => (event) => {
    event.stopPropagation();
    const start = Number(cue.timeSeconds ?? cue.start) || 0;
    const length = Math.max(0.2, (Number(cue.end) || start) - start);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic events have no pointer to capture */
    }
    clipDrag.current = {
      index,
      pointerId: event.pointerId,
      origin: event.clientX,
      start,
      length,
      node: event.currentTarget,
    };
    onDragging?.(true);
  };

  const onClipMove = (event) => {
    const drag = clipDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const width = dockRef.current?.getBoundingClientRect().width || 1;
    const delta = ((event.clientX - drag.origin) / width) * duration;
    const localStart = drag.start - shownOffset;
    const nextLocal = Math.max(0, Math.min(duration - drag.length, localStart + delta));
    drag.nextGlobal = shownOffset + nextLocal;
    drag.node.style.left = `${(nextLocal / duration) * 100}%`;
  };

  const onClipUp = (event) => {
    const drag = clipDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    clipDrag.current = null;
    const width = dockRef.current?.getBoundingClientRect().width || 1;
    const delta = ((event.clientX - drag.origin) / width) * duration;
    const localStart = drag.start - shownOffset;
    const nextLocal = Math.max(0, Math.min(duration - drag.length, localStart + delta));
    onCueMove?.(drag.index, drag.nextGlobal ?? shownOffset + nextLocal);
    onDragging?.(false);
  };

  const onTrimDown = (event) => {
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic events have no pointer to capture */
    }
    trimDrag.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originOffset: shownOffset,
      invert: event.currentTarget.dataset.trim === "wave",
    };
    onDragging?.(true);
  };

  const shiftTrim = (event, drag) => {
    const width = dockRef.current?.getBoundingClientRect().width || 1;
    const span = Math.max(duration, audioDuration || duration);
    let delta = ((event.clientX - drag.originX) / width) * span;
    if (drag.invert) delta = -delta;
    return clampAudioOffset(drag.originOffset + delta, audioDuration, duration);
  };

  const onTrimMove = (event) => {
    const drag = trimDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setLiveOffset(shiftTrim(event, drag));
  };

  const onTrimUp = (event) => {
    const drag = trimDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    trimDrag.current = null;
    const next = shiftTrim(event, drag);
    setLiveOffset(null);
    onAudioOffset?.(next);
    onDragging?.(false);
  };

  const windowWidth = audioDuration > duration ? (duration / audioDuration) * 100 : 100;
  const windowLeft = audioDuration > 0 ? (shownOffset / audioDuration) * 100 : 0;
  const visibleCues = useMemo(
    () => cuesInAudioWindow(cues, shownOffset, duration).map((cue) => {
      const start = Number(cue.timeSeconds ?? cue.start) || 0;
      const end = Math.max(start, Number(cue.end) || start);
      return {
        cue,
        index: cues.indexOf(cue),
        localStart: start - shownOffset,
        localEnd: end - shownOffset,
      };
    }),
    [cues, shownOffset, duration]
  );

  const activeEffect = normalizeParticleEffect(effect);

  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-stretch gap-2 border-t border-border/60 bg-card/90 px-3 py-2 text-foreground md:col-span-2 md:row-start-2">
      <div className="flex flex-col justify-around py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Audio</span>
        <span>Lyrics</span>
        <span>VFX</span>
      </div>
      <div
        ref={dockRef}
        className="relative"
        onPointerDown={onScrubDown}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubUp}
        onPointerCancel={onScrubUp}
      >
        <div
          ref={playheadRef}
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-primary"
          style={{ left: "0%" }}
        >
          <span className="absolute -left-1.5 -top-0.5 h-3 w-3 rounded-full bg-primary" />
        </div>
        <Lane>
          <canvas ref={waveRef} width={720} height={36} className="pointer-events-none h-9 w-full" />
          <button
            type="button"
            data-trim="wave"
            aria-label="Drag waveform to choose the audio cut"
            onPointerDown={onTrimDown}
            onPointerMove={onTrimMove}
            onPointerUp={onTrimUp}
            onPointerCancel={onTrimUp}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
          />
          <button
            type="button"
            data-trim="window"
            aria-label="Drag the selected audio window"
            onPointerDown={onTrimDown}
            onPointerMove={onTrimMove}
            onPointerUp={onTrimUp}
            onPointerCancel={onTrimUp}
            className="absolute bottom-0 top-0 z-10 cursor-grab rounded-md border-2 border-primary bg-primary/25 shadow-[0_0_16px_hsl(var(--primary)/0.45)] active:cursor-grabbing"
            style={{ left: `${windowLeft}%`, width: `${windowWidth}%`, touchAction: "none" }}
          />
          <span className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            Selected: {formatClock(shownOffset)} - {formatClock(shownOffset + duration)}
          </span>
        </Lane>
        <Lane>
          {visibleCues.map(({ cue, index, localStart, localEnd }) => {
            const left = (localStart / duration) * 100;
            const width = Math.max(4, ((localEnd - localStart) / duration) * 100);
            return (
              <button
                key={`${cue.text}-${index}`}
                type="button"
                data-clip="lyric"
                onPointerDown={onClipDown(index, cue)}
                onPointerMove={onClipMove}
                onPointerUp={onClipUp}
                onPointerCancel={onClipUp}
                className="absolute top-1 flex h-7 min-h-7 items-center overflow-hidden rounded-md border border-primary/40 bg-primary/25 px-1.5 text-left text-[10px] font-semibold text-foreground"
                style={{ left: `${left}%`, width: `${width}%`, touchAction: "none" }}
              >
                <span className="truncate">{cue.text}</span>
              </button>
            );
          })}
        </Lane>
        <Lane>
          <div
            className={`absolute inset-y-1 left-0 right-0 flex items-center rounded-md border px-2 text-[10px] font-semibold ${
              activeEffect === "none"
                ? "border-border/70 bg-muted/40 text-muted-foreground"
                : "border-fuchsia-400/40 bg-fuchsia-500/15 text-foreground"
            }`}
          >
            {activeEffect === "none" ? "No effect" : effectLabel(effect)}
          </div>
        </Lane>
      </div>
    </div>
  );
}

function Lane({ children }) {
  return <div className="relative my-1 h-9 overflow-hidden rounded-md bg-muted/50">{children}</div>;
}
