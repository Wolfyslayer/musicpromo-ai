import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import VideoTypeModal from "@/components/video/VideoTypeModal";

export default function CreateVideoButton({
  campaignId,
  dayId,
  query,
  children,
  variant = "outline",
  size = "sm",
  className = "",
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const confirm = ({ videoType, seconds }) => {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value != null && value !== "") params.set(key, String(value));
    });
    if (dayId) params.set("day", dayId);
    params.set("videoType", videoType);
    if (videoType === "promo") params.set("seconds", String(seconds || 15));
    navigate(`/campaigns/${campaignId}/video?${params.toString()}`);
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <VideoTypeModal open={open} onOpenChange={setOpen} onConfirm={confirm} />
    </>
  );
}
