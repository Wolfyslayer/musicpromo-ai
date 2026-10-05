/** AI song generation proxy (Suno-compatible HTTP API — bring your own provider key). */

export function sunoProviderStatus() {
  const base = (Deno.env.get("SUNO_API_BASE_URL") || "").trim().replace(/\/$/, "");
  const key = (Deno.env.get("SUNO_API_KEY") || "").trim();
  return {
    configured: Boolean(base && key),
    provider: base ? "suno_api" : "off",
    note: base
      ? "Song generation uses your SUNO_API_BASE_URL + SUNO_API_KEY (third-party Suno API gateway)."
      : "Set SUNO_API_BASE_URL and SUNO_API_KEY for Creator+ subscribers.",
  };
}

export async function generateSunoTrack(input: {
  prompt: string;
  lyrics?: string;
  title?: string;
  instrumental?: boolean;
}): Promise<{ audioUrl: string; taskId?: string; raw?: unknown }> {
  const base = (Deno.env.get("SUNO_API_BASE_URL") || "").trim().replace(/\/$/, "");
  const key = (Deno.env.get("SUNO_API_KEY") || "").trim();
  if (!base || !key) {
    throw new Error("Suno API is not configured (SUNO_API_BASE_URL, SUNO_API_KEY).");
  }

  const res = await fetch(`${base}/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      lyrics: input.lyrics || "",
      title: input.title || "",
      make_instrumental: Boolean(input.instrumental),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Suno API error (${res.status})`);
  }

  const audioUrl =
    data?.audio_url ||
    data?.audioUrl ||
    data?.data?.[0]?.audio_url ||
    data?.data?.[0]?.audioUrl ||
    "";
  if (!audioUrl) {
    throw new Error("Suno API did not return audio_url. Check your gateway response shape.");
  }

  return {
    audioUrl: String(audioUrl),
    taskId: data?.id || data?.task_id,
    raw: data,
  };
}
