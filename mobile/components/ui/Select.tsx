import React, { createContext, useContext, useMemo } from 'react';
import { Picker } from '@react-native-picker/picker';
import { Platform, Text, View } from 'react-native';
import { cn } from '@/lib/utils';

type Item = { value: string; label: string };

const SelectCtx = createContext<{ value: string; onValueChange: (v: string) => void; items: Item[] } | null>(
  null,
);

export function Select({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const items = useMemo(() => collectItems(children), [children]);
  return (
    <SelectCtx.Provider value={{ value, onValueChange, items }}>
      {children}
    </SelectCtx.Provider>
  );
}

export function SelectTrigger({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ctx = useContext(SelectCtx);
  if (!ctx) return null;
  return (
    <View className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      <Picker
        selectedValue={ctx.value || ctx.items[0]?.value}
        onValueChange={(v) => ctx.onValueChange(String(v))}
        style={Platform.OS === 'ios' ? { height: 44 } : undefined}
      >
        {ctx.items.map((it) => (
          <Picker.Item key={it.value} label={it.label} value={it.value} />
        ))}
      </Picker>
      {children}
    </View>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = useContext(SelectCtx);
  const label = ctx?.items.find((i) => i.value === ctx.value)?.label;
  return <Text className="text-sm text-foreground">{label || placeholder || 'Select…'}</Text>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectItem(_props: { value: string; children: React.ReactNode }) {
  return null;
}

function collectItems(node: React.ReactNode): Item[] {
  const items: Item[] = [];
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === SelectContent) {
      React.Children.forEach(child.props.children, (c) => {
        if (React.isValidElement(c) && c.type === SelectItem) {
          items.push({ value: String(c.props.value), label: String(c.props.children) });
        }
      });
    }
  });
  return items;
}
