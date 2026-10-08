import { useCallback, useEffect } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer as useExpoAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { logError } from "@/lib/errors";

/**
 * Expo Audio playback — play/pause/seek, exposes state.
 * Hook unloads when the component using it unmounts (expo-audio lifecycle).
 */
export function useAudioPlayer(url?: string | null) {
  const source = url ? { uri: url } : null;
  const player = useExpoAudioPlayer(source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    }).catch((e) => logError("audio.mode", e));
  }, []);

  const play = useCallback(() => {
    try {
      player.play();
    } catch (e) {
      logError("audio.play", e);
    }
  }, [player]);

  const pause = useCallback(() => {
    try {
      player.pause();
    } catch (e) {
      logError("audio.pause", e);
    }
  }, [player]);

  const toggle = useCallback(() => {
    if (status.playing) pause();
    else play();
  }, [status.playing, pause, play]);

  const seek = useCallback(
    (ms: number) => {
      try {
        player.seekTo(Math.max(0, ms) / 1000);
      } catch (e) {
        logError("audio.seek", e);
      }
    },
    [player]
  );

  const unload = useCallback(() => {
    try {
      player.pause();
      player.replace(null);
    } catch (e) {
      logError("audio.unload", e);
    }
  }, [player]);

  return {
    isPlaying: Boolean(status.playing),
    positionMs: Math.round((status.currentTime || 0) * 1000),
    durationMs: Math.round((status.duration || 0) * 1000),
    loading: Boolean(status.isBuffering),
    error: status.isLoaded === false && url ? "Could not load audio." : null,
    play,
    pause,
    toggle,
    seek,
    unload,
  };
}
