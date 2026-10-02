/**
 * Connects services (videoService, lyricsSync) to the hidden WebView in <RenderHost />.
 * Video rendering and lyric sync run in the web app's free in-browser pipeline
 * (Remotion + WebCodecs, Whisper via transformers.js), so no paid server or API is involved.
 */

export type BridgeProgress = { phase?: string; progress?: number; message?: string };

export type RenderBridge = {
  render: (project: any, options: { audioUrl: string; onProgress?: (info: BridgeProgress) => void }) => Promise<any>;
  transcribe: (options: { audioUrl: string; durationSec?: number; onProgress?: (info: BridgeProgress) => void }) => Promise<{ cues: any[] }>;
};

let bridge: RenderBridge | null = null;

export function registerRenderBridge(next: RenderBridge | null) {
  bridge = next;
}

export function getRenderBridge(): RenderBridge {
  if (!bridge) throw new Error('The render engine is not ready yet. Reopen the studio and try again.');
  return bridge;
}
