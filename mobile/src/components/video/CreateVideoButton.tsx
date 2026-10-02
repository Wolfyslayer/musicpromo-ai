import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';

import VideoTypeModal, { type VideoTypeChoice } from '@/components/video/VideoTypeModal';
import { Button, type ButtonProps } from '@/components/ui/button';

export default function CreateVideoButton({
  campaignId,
  dayId,
  query,
  children,
  variant = 'outline',
  size = 'sm',
  className = '',
}: {
  campaignId: string;
  dayId?: string;
  query?: Record<string, string | number | null | undefined>;
  children?: React.ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const confirm = ({ videoType, seconds }: VideoTypeChoice) => {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value != null && value !== '') params.set(key, String(value));
    });
    if (dayId) params.set('day', dayId);
    params.set('videoType', videoType);
    if (videoType === 'promo') params.set('seconds', String(seconds || 15));
    router.push(`/campaigns/${campaignId}/video?${params.toString()}` as Href);
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} onPress={() => setOpen(true)}>
        {children}
      </Button>
      <VideoTypeModal open={open} onOpenChange={setOpen} onConfirm={confirm} />
    </>
  );
}
