import * as Clipboard from 'expo-clipboard';
import { Copy, Pencil, RefreshCw, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { useState } from 'react';
import { View } from 'react-native';

import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Textarea } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';

type ContentItemProps = {
  item: any;
  onEdit: (item: any, text: string) => void | Promise<void>;
  onDelete: (item: any) => void | Promise<void>;
  onRegenerate?: (item: any) => void | Promise<void>;
  regenerateLabel?: string;
  extraActions?: React.ReactNode;
  children?: React.ReactNode;
};

export default function ContentItem({ item, onEdit, onDelete, onRegenerate, regenerateLabel = 'Regenerate', extraActions, children }: ContentItemProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [text, setText] = useState(item.content || '');

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(item.content || '');
      toast({ title: 'Copied' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
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
              }}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onPress={() => {
                setText(item.content || '');
                setEditing(false);
              }}>
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <>
          {children}
          <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 rounded-full px-2" onPress={copy}>
              <Icon as={Copy} size={12} />
              <Text className="text-xs font-medium">Copy</Text>
            </Button>
            <Button size="sm" variant="ghost" className="h-8 rounded-full px-2" onPress={() => setEditing(true)}>
              <Icon as={Pencil} size={12} />
              <Text className="text-xs font-medium">Edit</Text>
            </Button>
            {onRegenerate ? (
              <Button size="sm" variant="ghost" className="h-8 rounded-full px-2" onPress={() => onRegenerate(item)}>
                <Icon as={RefreshCw} size={12} />
                <Text className="text-xs font-medium">{regenerateLabel}</Text>
              </Button>
            ) : null}
            {extraActions}
            <Button size="sm" variant="ghost" className="h-8 rounded-full px-2" onPress={() => setConfirmDelete(true)}>
              <Icon as={Trash2} size={12} className="text-destructive" />
              <Text className="text-xs font-medium text-destructive">Delete</Text>
            </Button>
          </View>
        </>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this item?"
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => onDelete(item)}
      />
    </View>
  );
}
