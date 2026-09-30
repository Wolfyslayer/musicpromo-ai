/**
 * Video service — development / mock implementation.
 *
 * ====================================================================
 *  MOCK / DEVELOPMENT IMPLEMENTATION
 *  This does NOT render a real MP4. It produces a previewable project
 *  description and a placeholder export marker. Real server-side
 *  rendering (FFmpeg on Replit) should be implemented behind the same
 *  `renderVideo` / `exportVideo` interface — only this file changes.
 * ====================================================================
 *
 * Portable interface (implement for production later):
 *   renderVideo(project)  -> { previewUrl, duration, status }
 *   exportVideo(project)  -> { downloadUrl, status }
 *
 * The UI never assumes a real file exists; it always shows a clear
 * "Preview (mock)" badge until a real renderer is connected.
 */

import { getTemplate, VIDEO_RESOLUTION } from "./videoTemplates";

const MOCK_RENDER_DELAY = 900; // ms, simulates render time

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const videoService = {
  isMock: true,

  /** Build a preview descriptor for the editor. No real file is produced. */
  async renderVideo(project) {
    await wait(MOCK_RENDER_DELAY);
    const template = getTemplate(project.template);
    return {
      status: "ready",
      isMock: true,
      resolution: VIDEO_RESOLUTION,
      duration: project.duration || template.defaultDuration,
      template,
      // The editor renders a live CSS preview from the project; this is just metadata.
      previewUrl: null,
    };
  },

  /** Simulate an export. Returns a marker, never a real download URL. */
  async exportVideo(project) {
    await wait(MOCK_RENDER_DELAY * 2);
    return {
      status: "exported",
      isMock: true,
      downloadUrl: null,
      message:
        "Export is a mock in development. Connect an FFmpeg-based renderer (e.g. on Replit) to produce a real MP4.",
      project,
    };
  },
};

export default videoService;