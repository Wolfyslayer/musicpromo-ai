import { db } from '@/api/db';
import { uploadPromoAsset } from '@/services/supabaseStore';

const LISTENING = 'AI is listening and syncing your lyrics…';

/**
 * Transcribe audio via Edge Function (OpenAI Whisper) — same outcome as web worker.
 */
export async function syncLyricsFromAudio({ audioUrl, audioFile, durationSec = 15, onProgress } = {}) {
  onProgress?.({ phase: 'prepare', progress: 5, message: LISTENING });

  let url = String(audioUrl || '').trim();
  if (audioFile instanceof Blob) {
    onProgress?.({ phase: 'upload', progress: 15, message: 'Uploading audio…' });
    const uploaded = await uploadPromoAsset(audioFile, 'audio');
    url = uploaded?.publicUrl || uploaded?.public_url || '';
  }
  if (!url) throw new Error('Upload song audio before syncing lyrics.');

  onProgress?.({ phase: 'transcribe', progress: 40, message: LISTENING });
  const res = await db.functions.invoke('transcribeLyrics', {
    audioUrl: url,
    durationSec,
  });
  const payload = res?.data;
  if (payload?.error) throw new Error(payload.error);
  const cues = payload?.cues;
  if (!Array.isArray(cues) || !cues.length) {
    throw new Error('No lyrics detected in this clip.');
  }
  onProgress?.({ phase: 'done', progress: 100, message: 'Lyrics synced' });
  return cues;
}
