/**
 * AI song generation — TemPolor Open Platform (default) or legacy Suno-compatible gateway.
 * Secrets: SUNO_API_KEY, SUNO_API_BASE_URL (default https://api.tempolor.com), optional SUNO_API_MODEL.
 * TemPolor also requires PUBLIC_APP_URL for callback_url (see tempolorSongCallback).
 */

const TEMPOLOR_DEFAULT_BASE = "https://api.tempolor.com";
const TEMPOLOR_SUCCESS = 200000;
const POLL_MS = 4000;
const POLL_TIMEOUT_MS = 240_000;

type SunoGenerateInput = {
  prompt: string;
  lyrics?: string;
  title?: string;
  instrumental?: boolean;
};

type SunoGenerateResult = { audioUrl: string; taskId?: string; raw?: unknown };

function trimBase(raw: string): string {
  return String(raw || "").trim().replace(/\/$/, "");
}

function readConfig() {
  const key = (Deno.env.get("SUNO_API_KEY") || "").trim();
  const base = trimBase(Deno.env.get("SUNO_API_BASE_URL") || TEMPOLOR_DEFAULT_BASE);
  const model = (Deno.env.get("SUNO_API_MODEL") || "tempolor-latest").trim();
  const publicApp = trimBase(
    Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("APP_PUBLIC_URL") || ""
  );
  const legacy = Deno.env.get("SUNO_API_LEGACY") === "true";
  return { key, base, model, publicApp, legacy };
}

function isTempolorApi(base: string, legacy: boolean): boolean {
  if (legacy) return false;
  const b = base.toLowerCase();
  return (
    b.includes("tempolor.com") ||
    b.includes("tianpuyue.cn") ||
    base === TEMPOLOR_DEFAULT_BASE
  );
}

export function sunoProviderStatus() {
  const { key, base, model, publicApp, legacy } = readConfig();
  const tempolor = isTempolorApi(base, legacy);
  const configured = Boolean(key && (tempolor ? publicApp : base));
  return {
    configured,
    provider: configured ? (tempolor ? "tempolor" : "suno_gateway") : "off",
    model: tempolor ? model : undefined,
    note: !key
      ? "Set SUNO_API_KEY (TemPolor API key) and SUNO_API_BASE_URL for Creator+ subscribers."
      : tempolor && !publicApp
        ? "Set PUBLIC_APP_URL (TemPolor requires callback_url) plus SUNO_API_KEY."
        : tempolor
          ? "Song generation uses TemPolor (SUNO_API_* secrets) — async generate + poll."
          : "Song generation uses SUNO_API_BASE_URL + SUNO_API_KEY (legacy /generate gateway).",
  };
}

async function tempolorRequest<T = Record<string, unknown>>(
  base: string,
  key: string,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: key,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      String(data?.message || data?.error || `TemPolor API HTTP ${res.status}`)
    );
  }
  const status = Number(data?.status);
  if (status && status !== TEMPOLOR_SUCCESS) {
    throw new Error(String(data?.message || `TemPolor API error (${status})`));
  }
  return data as T;
}

function buildTempolorPrompt(input: SunoGenerateInput): string {
  const prompt = String(input.prompt || "").trim();
  const title = String(input.title || "").trim();
  if (!title) return prompt;
  if (!prompt) return title;
  if (prompt.toLowerCase().includes(title.toLowerCase())) return prompt;
  return `${title} — ${prompt}`;
}

function tempolorCallbackUrl(publicApp: string): string {
  if (!publicApp) {
    throw new Error(
      "PUBLIC_APP_URL is required for TemPolor (callback_url). Add it to Supabase / Base44 secrets."
    );
  }
  return `${publicApp}/functions/v1/tempolorSongCallback`;
}

async function pollTempolorSong(
  base: string,
  key: string,
  itemId: string
): Promise<SunoGenerateResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await tempolorRequest<{
      data?: { songs?: Record<string, unknown>[] };
    }>(base, key, "/open-apis/v1/song/query", { item_ids: [itemId] });

    const song = data?.data?.songs?.[0];
    if (!song) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }

    const status = String(song.status || "");
    if (status === "failed" || status === "part_failed") {
      throw new Error("TemPolor could not generate this song. Try a different prompt.");
    }

    const audioUrl = String(song.audio_url || song.streamAudioUrl || "").trim();
    if (
      audioUrl &&
      (status === "succeeded" || status === "main_succeeded" || status === "running")
    ) {
      return {
        audioUrl,
        taskId: itemId,
        raw: song,
      };
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error("Song generation timed out — TemPolor may still be processing. Try again shortly.");
}

async function generateViaTempolor(input: SunoGenerateInput): Promise<SunoGenerateResult> {
  const { key, base, model, publicApp } = readConfig();
  if (!key) {
    throw new Error("Song API is not configured (SUNO_API_KEY).");
  }

  const prompt = buildTempolorPrompt(input);
  if (!prompt) throw new Error("prompt is required");

  const started = await tempolorRequest<{ data?: { item_ids?: string[] } }>(
    base,
    key,
    "/open-apis/v1/song/generate",
    {
      model,
      prompt,
      lyrics: String(input.lyrics || ""),
      callback_url: tempolorCallbackUrl(publicApp),
      instrumental: Boolean(input.instrumental),
    }
  );

  const itemId = started?.data?.item_ids?.[0];
  if (!itemId) {
    throw new Error("TemPolor did not return item_ids. Check API credits and model name.");
  }

  return pollTempolorSong(base, key, String(itemId));
}

async function generateViaLegacyGateway(input: SunoGenerateInput): Promise<SunoGenerateResult> {
  const { key, base } = readConfig();
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
    throw new Error("Gateway did not return audio_url. Check SUNO_API_LEGACY / response shape.");
  }

  return {
    audioUrl: String(audioUrl),
    taskId: data?.id || data?.task_id,
    raw: data,
  };
}

export async function generateSunoTrack(input: SunoGenerateInput): Promise<SunoGenerateResult> {
  const cfg = readConfig();
  if (isTempolorApi(cfg.base, cfg.legacy)) {
    return generateViaTempolor(input);
  }
  return generateViaLegacyGateway(input);
}
