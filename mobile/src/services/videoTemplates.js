/**
 * Video template definitions — a reusable data structure so new templates can
 * be added by appending to this array. Each template describes how a 1080x1920
 * (9:16) promotional video is composed. The actual rendering is handled by the
 * video service (see videoService.js), which is currently a clearly-marked
 * development/mock implementation.
 */

export const VIDEO_TEMPLATES = [
  {
    id: "HOOK",
    name: "Hook",
    description: "Album artwork with animated zoom/pan and large bold text.",
    supportsWaveform: false,
    defaultDuration: 10,
    textFields: ["title", "hook"],
    animationDefault: "zoom-pan",
  },
  {
    id: "LYRICS",
    name: "Lyrics",
    description: "Album artwork/background with animated lyrics.",
    supportsWaveform: false,
    defaultDuration: 15,
    textFields: ["title", "lyrics"],
    animationDefault: "fade",
  },
  {
    id: "CINEMATIC",
    name: "Cinematic",
    description: "Artwork with slow movement, atmospheric effects and typography.",
    supportsWaveform: false,
    defaultDuration: 12,
    textFields: ["title", "subtitle"],
    animationDefault: "parallax",
  },
  {
    id: "WAVEFORM",
    name: "Waveform",
    description: "Artwork + audio waveform + artist/song information.",
    supportsWaveform: true,
    defaultDuration: 15,
    textFields: ["title", "artist"],
    animationDefault: "pulse",
  },
  {
    id: "RELEASE",
    name: "Release",
    description: "Artwork + release date + call to action.",
    supportsWaveform: false,
    defaultDuration: 8,
    textFields: ["title", "releaseDate", "cta"],
    animationDefault: "slide",
  },
  {
    id: "MINIMAL",
    name: "Minimal",
    description: "Clean artwork + song title + artist + subtle animation.",
    supportsWaveform: false,
    defaultDuration: 10,
    textFields: ["title", "artist"],
    animationDefault: "fade",
  },
];

export const getTemplate = (id) => VIDEO_TEMPLATES.find((t) => t.id === id) || VIDEO_TEMPLATES[0];

export const VIDEO_RESOLUTION = { width: 1080, height: 1920, ratio: "9:16", format: "mp4" };