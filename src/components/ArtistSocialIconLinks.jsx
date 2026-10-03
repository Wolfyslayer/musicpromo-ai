import { Facebook, Globe, Instagram, Music2, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

function XIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SpotifyIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

const LINK_DEFS = [
  { key: "instagram_url", label: "Instagram", Icon: Instagram, accent: "hover:text-[#e1306c]" },
  { key: "tiktok_url", label: "TikTok", Icon: Music2, accent: "hover:text-[#ff2d55]" },
  { key: "youtube_url", label: "YouTube", Icon: Youtube, accent: "hover:text-[#ff0000]" },
  { key: "spotify_url", label: "Spotify", Icon: SpotifyIcon, accent: "hover:text-[#1db954]" },
  { key: "facebook_url", label: "Facebook", Icon: Facebook, accent: "hover:text-[#1877f2]" },
  { key: "twitter_url", label: "X", Icon: XIcon, accent: "hover:text-foreground" },
  { key: "website", label: "Website", Icon: Globe, accent: "hover:text-primary" },
];

function normalizeHref(raw) {
  const href = String(raw || "").trim();
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  return `https://${href}`;
}

export default function ArtistSocialIconLinks({ artist, className, size = "md" }) {
  if (!artist) return null;
  const items = LINK_DEFS.map((def) => ({
    ...def,
    href: normalizeHref(artist[def.key]),
  })).filter((item) => item.href);

  if (!items.length) return null;

  const box = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-[1.125rem] w-[1.125rem]";

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map(({ key, label, href, Icon, accent }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${artist.name || "Artist"} on ${label}`}
          title={label}
          className={cn(
            "grid place-items-center rounded-full border border-border/60 bg-muted/25 text-muted-foreground transition",
            box,
            accent,
            "hover:border-border hover:bg-muted/50"
          )}
        >
          <Icon className={icon} aria-hidden />
        </a>
      ))}
    </div>
  );
}
