import { useState } from "react";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import VideoTypeModal from "@/components/video/VideoTypeModal";

/**
 * Same props as web. Extra Button props (icon, textClassName…) are forwarded so callers can pass a
 * lucide icon instead of rendering one inside children.
 */
export default function CreateVideoButton({
  campaignId,
  dayId,
  query,
  children,
  variant = "outline",
  size = "sm",
  className = "",
  ...buttonProps
}) {
  const [open, setOpen] = useState(false);

  const confirm = ({ videoType, seconds }) => {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value != null && value !== "") params.set(key, String(value));
    });
    if (dayId) params.set("day", dayId);
    params.set("videoType", videoType);
    if (videoType === "promo") params.set("seconds", String(seconds || 15));
    router.push(`/campaigns/${campaignId}/video?${params.toString()}`);
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} onPress={() => setOpen(true)} {...buttonProps}>
        {children}
      </Button>
      <VideoTypeModal open={open} onOpenChange={setOpen} onConfirm={confirm} />
    </>
  );
}
