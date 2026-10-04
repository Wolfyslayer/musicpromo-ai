import { SUPPORT_EMAIL } from "@/services/constants";

/**
 * mailto link to app support — use wherever we show "Contact support" or the address.
 */
export default function SupportEmailLink({ className = "underline hover:text-foreground", children }) {
  return (
    <a className={className} href={`mailto:${SUPPORT_EMAIL}`}>
      {children ?? SUPPORT_EMAIL}
    </a>
  );
}
