import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/toast';

export default function CopyButton({ text, label = 'Copy' }: { text?: string; label?: string }) {
  const { toast } = useToast();
  const copy = async () => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
      toast({ title: 'Copied' });
    } catch {
      toast({ title: 'Copy failed' });
    }
  };
  return <Button variant="ghost" className="min-h-9 px-2" label={label} onPress={copy} />;
}
