/** Mobile: browser Whisper worker unavailable — use manual lyrics or sync on web studio. */

export async function syncLyricsFromAudio() {
  throw new Error(
    'Automatic lyrics sync uses on-device ML in the web app. Type lyrics manually here, or sync on web Studio.',
  );
}
