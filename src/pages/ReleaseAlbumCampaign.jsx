import { Navigate, useParams } from "react-router-dom";

/** Legacy URL — same planner as /create?release= */
export default function ReleaseAlbumCampaign() {
  const { id } = useParams();
  return <Navigate to={`/create?release=${id}`} replace />;
}
