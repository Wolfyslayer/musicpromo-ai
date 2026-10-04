import { useState } from "react";
import { Copy, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

/**
 * A single piece of generated content (hook, caption, hashtag set, CTA, video concept).
 * Supports copy, edit, delete and regenerate. Never locks the user into AI output.
 */
export default function ContentItem({ item, onEdit, onDelete, onRegenerate, regenerateLabel = "Regenerate", extraActions, children }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.content || "");
  const { toast } = useToast();

  const copy = () => {
    navigator.clipboard?.writeText(item.content || "");
    toast({ title: "Copied" });
  };

  return (
    <div className="rounded-xl bg-muted/30 p-3">
      {editing ? (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="rounded-lg bg-background" />
          <div className="flex gap-2">
            <Button size="sm" className="rounded-full" onClick={() => { onEdit(item, text); setEditing(false); }}>Save</Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setText(item.content || ""); setEditing(false); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          {children}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={copy}><Copy className="mr-1 h-3 w-3" />Copy</Button>
            <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => setEditing(true)}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
            {onRegenerate && (
              <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => onRegenerate(item)}><RefreshCw className="mr-1 h-3 w-3" />{regenerateLabel}</Button>
            )}
            {extraActions}
            <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs text-destructive hover:text-destructive" onClick={() => onDelete(item)}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
          </div>
        </>
      )}
    </div>
  );
}