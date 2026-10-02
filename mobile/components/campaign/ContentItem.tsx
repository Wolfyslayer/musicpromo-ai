// @ts-nocheck
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from "react";
import { Copy, Pencil, Trash2, RefreshCw, Film } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ModalForm';
import { useToast } from '@/lib/toast';

/**
 * A single piece of generated content (hook, caption, hashtag set, CTA, video concept).
 * Supports copy, edit, delete and regenerate. Never locks the user into AI output.
 */
export default function ContentItem({ item, onEdit, onDelete, onRegenerate, regenerateLabel = "Regenerate", extraActions, children }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.content || "");
  const { toast } = useToast();

  const copy = async () => {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(item.content || '');
    toast({ title: 'Copied' });
  };

  return (
    <View className="rounded-xl bg-muted/30 p-3">
      {editing ? (
        <View className="space-y-2">
          <Textarea value={text} onChangeText={setText} rows={3} className="rounded-lg bg-background" />
          <View className="flex gap-2">
            <Button size="sm" className="rounded-full" onClick={() => { onEdit(item, text); setEditing(false); }}>Save</Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setText(item.content || ""); setEditing(false); }}>Cancel</Button>
          </View>
        </View>
      ) : (
        <>
          {children}
          <View className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={copy}><Copy />Copy</Button>
            <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => setEditing(true)}><Pencil />Edit</Button>
            {onRegenerate && (
              <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => onRegenerate(item)}><RefreshCw />{regenerateLabel}</Button>
            )}
            {extraActions}
            <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs text-destructive hover:text-destructive" onClick={() => onDelete(item)}><Trash2 />Delete</Button>
          </View>
        </>
      )}
    </View>
  );
}