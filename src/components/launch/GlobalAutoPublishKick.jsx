import { useGlobalAutoPublishKick } from "@/hooks/useGlobalAutoPublishKick";

/** Invisible helper — nudges campaignWorker while a signed-in user has the app open. */
export default function GlobalAutoPublishKick({ enabled }) {
  useGlobalAutoPublishKick(enabled);
  return null;
}
