# Video render worker

The mobile app does not render video. `requestVideoRender` (Supabase Edge Function) validates a job and forwards it to an external worker. The worker renders a 1080x1920 MP4, uploads it, and reports back to `renderVideoCallback`.

```
app -> requestVideoRender -> POST VIDEO_RENDER_WORKER_URL
                                   |  (render, upload MP4)
app <- polls rendering_status <- renderVideoCallback <- POST callbackUrl
```

## Secrets

Set on the Edge Functions (and on the worker where noted):

| Name | Where | Purpose |
| --- | --- | --- |
| `VIDEO_RENDER_WORKER_URL` | Supabase | HTTPS endpoint that accepts jobs |
| `VIDEO_RENDER_WORKER_SECRET` | Supabase + worker | Shared secret, both directions |
| `OPENAI_API_KEY` | Supabase | Optional; enables `transcribeLyrics` (lyric auto-sync) |

If the worker variables are missing, `requestVideoRender` marks the project `failed` and returns HTTP 503 `{ ok: false, code: "RENDER_WORKER_NOT_CONFIGURED" }`. Without `OPENAI_API_KEY`, `transcribeLyrics` returns 503 `TRANSCRIPTION_NOT_CONFIGURED` and the app falls back to manual lyrics / SRT import.

## Job request (Supabase -> worker)

`POST $VIDEO_RENDER_WORKER_URL` with `Authorization: Bearer $VIDEO_RENDER_WORKER_SECRET` and `Content-Type: application/json`. Respond 2xx quickly (accept the job, render asynchronously).

```json
{
  "jobId": "uuid",
  "projectId": "uuid",
  "campaignId": "uuid | null",
  "userId": "uuid",
  "callbackUrl": "https://<project>.supabase.co/functions/v1/renderVideoCallback",
  "output": { "bucket": "music-promo-assets", "path": "<userId>/video/<projectId>-<jobId>.mp4", "contentType": "video/mp4" },
  "width": 1080, "height": 1920, "fps": 60,
  "artworkUrl": "https://...", "audioUrl": "https://...",
  "duration": 15,
  "audioStartTimeOffset": 0,
  "videoType": "promo | lyrics",
  "title": "", "artistName": "", "text": "", "lyrics": "", "outroCta": "",
  "visualStyle": "pop | hiphop | rock",
  "particleEffect": "none | stardust | smoke | sparks | leaks | vhs | neon | vinyl | rings | shake | prism | fluid | grain",
  "look": { "fontId": "sans", "fontSize": 64, "textColor": "#f2ecff", "letterSpacing": 0, "animationMs": 280,
            "lyricX": 50, "lyricY": 82, "particleX": 50, "particleY": 88, "wind": 0.25, "particleSpeed": 0.45 },
  "lyricCues": [{ "text": "", "start": 0, "end": 2.5, "timeSeconds": 0 }]
}
```

Cue times are absolute positions in the song. Only cues inside `[audioStartTimeOffset, audioStartTimeOffset + duration]` are shown; the composition clock starts at the offset (same as `cuesInAudioWindow` in `src/remotion/styles.js`). All asset URLs are public HTTPS.

## Callback (worker -> Supabase)

`POST callbackUrl` with header `x-render-secret: $VIDEO_RENDER_WORKER_SECRET` (compared in constant time; no JWT).

```json
{ "projectId": "uuid", "jobId": "uuid", "status": "rendering", "progress": 42 }
{ "projectId": "uuid", "jobId": "uuid", "status": "complete", "videoUrl": "https://.../video.mp4" }
{ "projectId": "uuid", "jobId": "uuid", "status": "failed", "error": "short message" }
```

- `jobId` is optional but recommended: callbacks for an older job are ignored (`{ ok: true, ignored: true }`).
- `complete` requires a public HTTPS `videoUrl`. The function sets `rendering_status=complete`, `render_output_url`, `status=ready`, `resolution=1080x1920`, `output_format=mp4`, and links the video to the campaign (`attachClientRenderedVideo`) when the project has a `campaignId`.
- Send `rendering` updates every few seconds; the app polls the project row every 4 s for up to 10 minutes.
- Responses: 200 ok, 400 invalid body, 401 bad secret, 404 unknown project, 503 secret not set on the function.

## Suggested implementation

1. Reuse `src/remotion/PromoComposition.jsx` (with `ParticleOverlay`, `audioReactive`, `fonts`) unchanged; map the job fields to its input props exactly as `renderPromoRemotion.js` does for the browser render.
2. Pick one runtime:
   - Remotion Lambda: a small HTTPS handler (API Gateway/Lambda URL) verifies the bearer secret, calls `renderMediaOnLambda` with `outName`, and uses its progress webhook / `getRenderProgress` polling to post `rendering` callbacks.
   - Cloud Run container: Node + Chromium + FFmpeg running `@remotion/renderer` `renderMedia` (`codec: "h264"`, `fps: 60`, 1080x1920). Ack the request with 202, render in the background, post progress from `onProgress`.
3. Upload the MP4 to the `music-promo-assets` bucket at `output.path` with the Supabase service-role key (kept on the worker), then use `getPublicUrl` for `videoUrl`.
4. On any error post `failed` with a user-safe message; always finish with `complete` or `failed` so the project never stays `rendering`.
5. Limits: lyrics videos can be up to 600 s; use a Lambda/container timeout above the longest expected render and download audio once per job.
