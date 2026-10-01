import { useCallback, useEffect, useRef } from "react";

/**
 * Studio playback runs on one Web Audio clock for the life of the preview.
 * Trim and layout drags do not recreate the context or seek the buffer.
 * The element is seeked once when the cut is committed or the playhead jumps.
 */
export function useIsolatedPreviewAudio({ url = "", offsetSec = 0, windowSec = 15, playing = false }) {
  const audioRef = useRef(null);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const offsetRef = useRef(offsetSec);
  const windowRef = useRef(windowSec);
  const timelineRef = useRef(0);
  const holdRef = useRef(false);

  offsetRef.current = Math.max(0, Number(offsetSec) || 0);
  windowRef.current = Math.max(0.2, Number(windowSec) || 15);

  const place = useCallback((timelineSec) => {
    const audio = audioRef.current;
    if (!audio || holdRef.current) return;
    const start = offsetRef.current;
    const span = windowRef.current;
    const next = Math.min(start + span - 0.05, Math.max(start, start + Math.max(0, Number(timelineSec) || 0)));
    if (!Number.isFinite(audio.currentTime) || Math.abs(audio.currentTime - next) > 0.08) {
      audio.currentTime = next;
    }
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    let context = null;
    try {
      context = new AudioContext();
      contextRef.current = context;
      const node = context.createMediaElementSource(audio);
      sourceRef.current = node;
      node.connect(context.destination);
    } catch {
      context = null;
    }

    const keepWindow = () => {
      if (holdRef.current || !audioRef.current) return;
      const start = offsetRef.current;
      const end = start + windowRef.current;
      if (audio.currentTime >= end - 0.05) audio.currentTime = start;
    };
    audio.addEventListener("timeupdate", keepWindow);
    audio.addEventListener("ended", keepWindow);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", keepWindow);
      audio.removeEventListener("ended", keepWindow);
      try {
        sourceRef.current?.disconnect();
      } catch {
        /* node may already be disconnected */
      }
      sourceRef.current = null;
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      context?.close().catch(() => {});
      contextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    if (!url) {
      audio.pause();
      return undefined;
    }
    const absolute = new URL(url, window.location.href).href;
    if (audio.src !== absolute) audio.src = absolute;
    return undefined;
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    const context = contextRef.current;
    if (!audio || !url) return undefined;
    if (!playing) {
      audio.pause();
      return undefined;
    }
    let cancelled = false;
    const resume = context?.state === "suspended" ? context.resume() : Promise.resolve();
    resume
      .then(() => {
        if (cancelled || holdRef.current) return null;
        place(timelineRef.current);
        return audio.play();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [playing, url, place]);

  useEffect(() => {
    if (holdRef.current) return undefined;
    place(timelineRef.current);
    return undefined;
  }, [offsetSec, windowSec, place]);

  const seek = useCallback(
    (timelineSec) => {
      timelineRef.current = Math.max(0, Number(timelineSec) || 0);
      place(timelineRef.current);
    },
    [place]
  );

  const setHold = useCallback((holding) => {
    holdRef.current = Boolean(holding);
  }, []);

  const noteTimeline = useCallback((timelineSec) => {
    timelineRef.current = Math.max(0, Number(timelineSec) || 0);
  }, []);

  return { seek, setHold, noteTimeline };
}
