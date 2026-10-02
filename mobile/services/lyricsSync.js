import { db } from '@/api/db';
import { lyricsSyncUsesOpenAiApi } from '@/lib/webApp';
import { uploadPromoAsset } from '@/services/supabaseStore';

const LISTENING = 'AI is listening and syncing your lyrics…';

export async function prepareAudioUrlForSync({ audioUrl, audioFile, onProgress } = {}) {
  return resolveAudioUrl(audioUrl, audioFile, onProgress);
}

async function resolveAudioUrl(audioUrl, audioFile, onProgress) {
  let url = String(audioUrl || '').trim();
  if (audioFile instanceof Blob) {
    onProgress?.({ phase: 'upload', progress: 15, message: 'Uploading audio…' });
    const uploaded = await uploadPromoAsset(audioFile, 'audio');
    url = uploaded?.publicUrl || uploaded?.public_url || '';
  }
  if (!url) throw new Error('Upload song audio before syncing lyrics.');
  return url;
}

/**
 * Optional paid path: OpenAI Whisper on Supabase (uses OPENAI_API_KEY — same billing as InvokeLLM).
 * Default mobile UX uses the free web bridge instead; see LyricsSyncWebView.
 */
export async function syncLyricsFromAudioViaOpenAi({ audioUrl, audioFile, durationSec = 15, onProgress } = {}) {
  onProgress?.({ phase: 'prepare', progress: 5, message: LISTENING });
  const url = await resolveAudioUrl(audioUrl, audioFile, onProgress);
  onProgress?.({ phase: 'transcribe', progress: 40, message: LISTENING });
  const res = await db.functions.invoke('transcribeLyrics', { audioUrl: url, durationSec });
  const payload = res?.data;
  if (payload?.error) throw new Error(payload.error);
  const cues = payload?.cues;
  if (!Array.isArray(cues) || !cues.length) {
    throw new Error('No lyrics detected in this clip.');
  }
  onProgress?.({ phase: 'done', progress: 100, message: 'Lyrics synced' });
  return cues;
}

/**
 * Programmatic sync entry — only when explicitly configured for OpenAI API.
 * UI should prefer LyricsSyncWebView (free, same as web).
 */
export async function syncLyricsFromAudio(opts = {}) {
  if (lyricsSyncUsesOpenAiApi()) {
    return syncLyricsFromAudioViaOpenAi(opts);
  }
  throw new Error(
    'Free lyrics sync runs in the web bridge. Set EXPO_PUBLIC_WEB_APP_URL to your deployed web app, or type/import SRT lyrics manually.',
  );
}
