import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function CopyButton({ text, label, className = "" }) {
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const copy = async (e) => {
    e?.stopPropagation?.();
    try {
      await navigator.clipboard.writeText(text || "");
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast({ variant: "destructive", title: "Copy failed" });
    }
  };
  return (
    <button type="button" onClick={copy} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-500 transition ${done ? "bg-chart-2/15 text-chart-2" : "bg-muted text-muted-foreground hover:text-foreground"} ${className}`}>
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label || "Copy"}
    </button>
  );
}