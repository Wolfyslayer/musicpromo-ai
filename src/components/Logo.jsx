import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

function logoAssetUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}musicpromo-ai-icon.svg`;
}

export default function Logo({ size = 28, withWord = true, className, linkToHome = false }) {
  const content = (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <img
        src={logoAssetUrl()}
        alt="MusicPromo AI"
        width={size}
        height={size}
        className="shrink-0 rounded-xl object-cover"
        style={{ width: size, height: size }}
        decoding="async"
      />
      {withWord ? (
        <div className="font-heading font-semibold leading-none tracking-tight">
          <span className="text-foreground">MusicPromo</span>
          <span className="text-gradient"> AI</span>
        </div>
      ) : null}
    </div>
  );

  if (linkToHome) {
    return (
      <Link to="/" className="rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
        {content}
      </Link>
    );
  }

  return content;
}
