import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/** Legacy /create/track URLs → unified release wizard (upload step). */
export default function CreateTrackRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const release = searchParams.get("release") || "";
    const song = searchParams.get("song") || "";
    if (release) {
      const q = new URLSearchParams({ release });
      if (song) q.set("song", song);
      navigate(`/create?${q.toString()}`, { replace: true });
    } else {
      navigate("/create", { replace: true });
    }
  }, [navigate, searchParams]);

  return <div className="h-32 animate-shimmer rounded-2xl" />;
}
