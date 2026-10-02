import { LegalDocument } from "@/components/LegalDocument";
import { PRIVACY_SECTIONS } from "@/lib/legal";

export default function Privacy() {
  return <LegalDocument title="Privacy Policy" sections={PRIVACY_SECTIONS} />;
}
