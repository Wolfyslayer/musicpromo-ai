import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';

export default function CreateVideoButton({
  campaignId,
  dayId,
  className,
  children,
  query = {},
}: {
  campaignId: string;
  dayId?: string;
  className?: string;
  children?: React.ReactNode;
  query?: Record<string, string>;
}) {
  const router = useRouter();
  const params = new URLSearchParams(query);
  if (dayId) params.set('day', dayId);
  const qs = params.toString();
  return (
    <Button
      variant="outline"
      className={className}
      onPress={() => router.push(`/campaigns/${campaignId}/video${qs ? `?${qs}` : ''}` as never)}
    >
      {children}
    </Button>
  );
}
