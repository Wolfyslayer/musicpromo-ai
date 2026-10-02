import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { messageFromFunctionInvokeError } from "@/lib/functionInvokeError";

export default function YouTubeAuthCallback() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!supabase) throw new Error("Supabase is not configured.");

        const url = new URL(window.location.href);
        const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (oauthError) {
          throw new Error(decodeURIComponent(oauthError.replace(/\+/g, " ")));
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          throw new Error("Missing authorization data from Google.");
        }

        const { data, error: fnError } = await supabase.functions.invoke("youtubeOAuthComplete", {
          body: { code, state },
        });
        if (fnError) throw new Error(await messageFromFunctionInvokeError(fnError));
        if (!data?.ok) throw new Error(data?.error || "Could not finish YouTube connection.");

        if (!cancelled) {
          window.location.replace("/social?social_connected=youtube");
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "YouTube connection failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-destructive">{error}</p>
        <Link to="/social" className="text-sm text-primary underline">
          Back to Social Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Finishing YouTube connection…</p>
    </div>
  );
}
