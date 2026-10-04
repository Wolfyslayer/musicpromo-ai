import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import SupportEmailLink from "@/components/SupportEmailLink";

/**
 * Shared chrome for public legal pages (no login required — needed for TikTok / Google app review).
 */
export default function LegalPage({ title, children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="glass-bar border-b border-border/40 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/">
            <Logo size={32} />
          </Link>
          <nav className="flex gap-3 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="prose-legal space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-600 [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
        <p className="pt-6 text-xs text-muted-foreground">
          Last updated: October 1, 2026 ·{" "}
          <SupportEmailLink>Contact support</SupportEmailLink>
        </p>
      </main>
    </div>
  );
}
