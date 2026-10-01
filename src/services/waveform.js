const cache = new Map();

/** Decode once per URL. Peaks stay static; duration sizes the trim window. */
export async function loadAudioProfile(url, buckets = 280) {
  const key = `${url}|${buckets}`;
  if (cache.has(key)) return cache.get(key);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not read audio for the waveform.");
  const bytes = await response.arrayBuffer();
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(bytes.slice(0));
    const channel = audio.getChannelData(0);
    const size = Math.max(1, Math.floor(channel.length / buckets));
    const peaks = new Float32Array(buckets);
    const step = Math.max(1, Math.floor(size / 24));
    for (let i = 0; i < buckets; i += 1) {
      let max = 0;
      const start = i * size;
      for (let j = 0; j < size; j += step) {
        const sample = Math.abs(channel[start + j] || 0);
        if (sample > max) max = sample;
      }
      peaks[i] = max;
    }
    const profile = { peaks, duration: Number(audio.duration) || 0 };
    cache.set(key, profile);
    return profile;
  } finally {
    context.close().catch(() => {});
  }
}

/** Static peak envelope for the timeline. Cached per URL so scrubbing does not re-decode. */
export async function loadWaveformPeaks(url, buckets = 180) {
  const profile = await loadAudioProfile(url, buckets);
  return profile.peaks;
}
