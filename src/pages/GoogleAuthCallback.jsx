import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { completeGoogleSignInFromUrl } from "@/lib/completeGoogleSignIn";
import { clearGoogleSignInSessionAll } from "@/lib/googleAuthStorage";

export default function GoogleAuthCallback() {
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { destination } = await completeGoogleSignInFromUrl(window.location.href);
        if (!cancelled) navigate(destination, { replace: true });
      } catch (err) {
        clearGoogleSignInSessionAll();
        if (!cancelled) setError(err?.message || "Google sign-in failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-destructive">{error}</p>
        <Link to="/login" className="text-sm text-primary underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Finishing Google sign-in…</p>
    </div>
  );
}
