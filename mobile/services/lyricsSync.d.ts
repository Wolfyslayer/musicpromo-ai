export function syncLyricsFromAudio(options?: {
  audioUrl?: string;
  audioFile?: Blob;
  durationSec?: number;
  onProgress?: (info: { phase?: string; progress?: number; message?: string }) => void;
}): Promise<Array<{ text: string; start: number; end: number; timeSeconds: number }>>;
