/**
 * Centralized Social Hub platform configuration.
 * Static UI metadata only — no secrets, tokens, or API keys.
 * Separate from campaign PLATFORMS in constants.js (which includes Spotify/X etc.).
 */

export const SOCIAL_PROVIDERS = [
  {
    id: "instagram",
    name: "Instagram",
    description: "Connect your Instagram account for Reels and feed posts.",
    icon: "Instagram",
    color: "#e1306c",
    providerId: "instagram",
    configured: false,
    available: false,
    oauthImplemented: true,
    capabilities: {
      connect: false,
      publish: false,
      schedule: false,
      media: false,
      video: false,
      image: false,
      text: false,
      analytics: false,
    },
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Connect your TikTok account for short-form promo videos.",
    icon: "Music2",
    color: "#ff2d55",
    providerId: "tiktok",
    configured: false,
    available: false,
    capabilities: {
      connect: false,
      publish: false,
      schedule: false,
      media: false,
      video: false,
      image: false,
      text: false,
      analytics: false,
    },
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Connect your YouTube channel for Shorts and video posts.",
    icon: "Youtube",
    color: "#ff0000",
    providerId: "youtube",
    configured: false,
    available: false,
    capabilities: {
      connect: false,
      publish: false,
      schedule: false,
      media: false,
      video: false,
      image: false,
      text: false,
      analytics: false,
    },
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Connect your Facebook Page for posts and video.",
    icon: "Facebook",
    color: "#1877f2",
    providerId: "facebook",
    configured: false,
    available: false,
    capabilities: {
      connect: false,
      publish: false,
      schedule: false,
      media: false,
      video: false,
      image: false,
      text: false,
      analytics: false,
    },
  },
];

export const getSocialProviderConfig = (id) =>
  SOCIAL_PROVIDERS.find((p) => p.id === id) || null;
