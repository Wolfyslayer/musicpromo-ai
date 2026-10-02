import { useEffect, useState } from 'react';

export type ToastInput = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
};
export type ToastItem = ToastInput & { id: string };

let items: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();
let counter = 0;

function emit() {
  listeners.forEach((l) => l(items));
}

export function dismiss(id: string) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(input: ToastInput) {
  const id = String(++counter);
  items = [...items.slice(-2), { ...input, id }];
  emit();
  setTimeout(() => dismiss(id), input.duration ?? 3500);
  return { id, dismiss: () => dismiss(id) };
}

export function useToast() {
  const [state, setState] = useState(items);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return { toasts: state, toast, dismiss };
}
