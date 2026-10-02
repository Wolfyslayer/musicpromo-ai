import { useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Copy, Pencil, RefreshCw, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const ACTION_CLASS = "h-7 rounded-full px-2";

/**
 * A single piece of generated content (hook, caption, hashtag set, CTA, video concept).
 * Supports copy, edit, delete and regenerate. Never locks the user into AI output.
 */
export default function ContentItem({ item, onEdit, onDelete, onRegenerate, regenerateLabel = "Regenerate", extraActions, children }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.content || "");
  const { toast } = useToast();

  const copy = async () => {
    await Clipboard.setStringAsync(item.content || "").catch(() => {});
    toast({ title: "Copied" });
  };

  return (
    <View className="rounded-xl bg-muted/30 p-3">
      {editing ? (
        <View className="gap-2">
          <Textarea value={text} onChangeText={setText} numberOfLines={3} className="rounded-lg bg-background" />
          <View className="flex-row gap-2">
            <Button
              size="sm"
              className="rounded-full"
              onPress={() => {
                onEdit(item, text);
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onPress={() => {
                setText(item.content || "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <>
          {children}
          <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
            <Button size="sm" variant="ghost" icon={Copy} className={ACTION_CLASS} onPress={copy}>
              Copy
            </Button>
            <Button size="sm" variant="ghost" icon={Pencil} className={ACTION_CLASS} onPress={() => setEditing(true)}>
              Edit
            </Button>
            {onRegenerate ? (
              <Button size="sm" variant="ghost" icon={RefreshCw} className={ACTION_CLASS} onPress={() => onRegenerate(item)}>
                {regenerateLabel}
              </Button>
            ) : null}
            {extraActions || null}
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              className={ACTION_CLASS}
              textClassName="text-destructive"
              onPress={() => onDelete(item)}
            >
              Delete
            </Button>
          </View>
        </>
      )}
    </View>
  );
}
