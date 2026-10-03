import { Facebook, Globe, Instagram, Music2, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpotifyIcon, XIcon } from "@/components/social/SocialBrandIcons";

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
