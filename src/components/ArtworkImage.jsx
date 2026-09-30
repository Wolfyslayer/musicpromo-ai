import { Image as ImageIcon } from "lucide-react";
import { Image } from "@/components/ui/image";

/**
 * Consistent album-artwork renderer. Uses the shadcn Image component for
 * platform-hosted media (resized/WebP) and falls back gracefully.
 */
export default function ArtworkImage({ src, alt = "Artwork", className = "", rounded = "rounded-2xl" }) {
  if (!src) {
    return (
      <div className={`grid place-items-center bg-muted/60 ${rounded} ${className}`}>
        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fittingType="fill"
      className={`${rounded} object-cover ${className}`}
    />
  );
}