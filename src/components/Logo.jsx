import { Sparkles } from "lucide-react";

export default function Logo({ size = 28, withWord = true }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className="relative grid place-items-center rounded-xl"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, hsl(265 90% 68%), hsl(326 85% 62%))",
          boxShadow: "0 6px 20px -6px hsl(265 90% 68% / 0.6)",
        }}
      >
        <Sparkles size={size * 0.5} className="text-white" strokeWidth={2.5} />
      </div>
      {withWord && (
        <div className="font-heading font-700 leading-none tracking-tight">
          <span className="text-foreground">MusicPromo</span>
          <span className="text-gradient"> AI</span>
        </div>
      )}
    </div>
  );
}