import { LegalDocument } from "@/components/LegalDocument";
import { TERMS_SECTIONS } from "@/lib/legal";

export default function Terms() {
  return <LegalDocument title="Terms of Service" sections={TERMS_SECTIONS} />;
}