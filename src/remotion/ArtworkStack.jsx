import { interpolate, useCurrentFrame } from "remotion";

/**
 * Cover with parallax chromatic edges + floor reflection — premium promo look from a static PNG.
 */
export default function ArtworkStack({
  artworkUrl,
  coverTransform,
  polish = false,
  bass = 0,
  transient = 0,
}) {
  const frame = useCurrentFrame();
  if (!artworkUrl) return null;

  const chroma = polish ? Math.min(6, 2 + transient * 8 + bass * 3) : 0;
  const glow = polish ? 0.35 + bass * 0.45 + transient * 0.35 : 0.2;
  const introScale = polish
    ? interpolate(frame, [0, 24], [0.92, 1], { extrapolateRight: "clamp" })
    : 1;

  const baseStyle = {
    width: 720,
    height: 720,
    objectFit: "cover",
    borderRadius: 28,
  };

  return (
    <div
      style={{
        position: "relative",
        transform: `${coverTransform} scale(${introScale})`,
        filter: polish ? `saturate(1.12) contrast(1.06) drop-shadow(0 0 ${40 + glow * 50}px rgba(167,139,250,${0.25 + glow * 0.35}))` : undefined,
      }}
    >
      {polish && chroma > 0.5 ? (
        <>
          <img
            src={artworkUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              ...baseStyle,
              position: "absolute",
              left: 0,
              top: 0,
              opacity: 0.45,
              transform: `translate(${-chroma}px, 0)`,
              filter: "hue-rotate(-18deg) blur(0.3px)",
              mixBlendMode: "screen",
            }}
          />
          <img
            src={artworkUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              ...baseStyle,
              position: "absolute",
              left: 0,
              top: 0,
              opacity: 0.45,
              transform: `translate(${chroma}px, 0)`,
              filter: "hue-rotate(22deg) blur(0.3px)",
              mixBlendMode: "screen",
            }}
          />
        </>
      ) : null}
      <img
        src={artworkUrl}
        alt=""
        crossOrigin="anonymous"
        style={{
          ...baseStyle,
          position: "relative",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        }}
      />
      {polish ? (
        <div
          style={{
            marginTop: -8,
            height: 220,
            overflow: "hidden",
            borderRadius: "0 0 28px 28px",
            opacity: 0.28 + bass * 0.15,
            transform: "scaleY(-1)",
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 85%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 85%)",
          }}
        >
          <img
            src={artworkUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: 720,
              height: 720,
              objectFit: "cover",
              filter: "blur(10px) brightness(0.7)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
