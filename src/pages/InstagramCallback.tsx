import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Instagram, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Handles the Instagram OAuth callback.
 * Meta redirects here with ?code=... after the user approves.
 * This page exchanges the code for tokens via the instagram-auth edge function.
 */
const InstagramCallback = () => {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Connecting your Instagram account...");
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const url    = new URL(window.location.href);
    const code   = url.searchParams.get("code");
    const errMsg = url.searchParams.get("error_description");

    if (errMsg) {
      setStatus("error");
      setMessage(decodeURIComponent(errMsg));
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received from Instagram.");
      return;
    }

    if (!user) {
      // Wait for auth to initialize — useEffect will re-run when user is set
      return;
    }

    const redirectUri = `${window.location.origin}/instagram-callback`;
    handleCallback(code, redirectUri);
  }, [user]);

  const handleCallback = async (code: string, redirectUri: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("instagram-auth", {
        body: {
          action:       "callback",
          code,
          redirect_uri: redirectUri,
          user_id:      user!.id,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Connection failed");
      }

      setUsername(data.username || null);
      setStatus("success");
      setMessage("Instagram connected successfully!");

      // Trigger initial sync in the background
      supabase.functions.invoke("instagram-sync", {
        body: { user_id: user!.id },
      }).catch(console.warn);

      // Redirect back after a short delay
      setTimeout(() => navigate("/hashtag-analysis"), 2500);

    } catch (err) {
      console.error("Instagram callback error:", err);
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full text-center space-y-5">

        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
          status === "success" ? "bg-emerald-500/15" :
          status === "error"   ? "bg-red-500/15" :
          "bg-primary/10"
        }`}>
          {status === "processing" && <Loader2 className="w-7 h-7 text-primary animate-spin" />}
          {status === "success"    && <CheckCircle2 className="w-7 h-7 text-emerald-400" />}
          {status === "error"      && <AlertTriangle className="w-7 h-7 text-red-400" />}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-foreground">
            {status === "processing" && "Connecting Instagram"}
            {status === "success"    && "Connected!"}
            {status === "error"      && "Connection Failed"}
          </h1>
          {username && status === "success" && (
            <p className="text-sm font-medium text-primary">@{username}</p>
          )}
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        {/* Actions */}
        {status === "success" && (
          <p className="text-xs text-muted-foreground">
            Redirecting you back... Your recent posts are syncing in the background.
          </p>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <Button onClick={() => navigate("/hashtag-analysis")} className="w-full gap-2">
              <Instagram className="w-4 h-4" />
              Back to Hashtag Analysis
            </Button>
            <p className="text-xs text-muted-foreground">
              If this keeps happening, check that your Meta App has the correct redirect URI configured.
            </p>
          </div>
        )}

        {status === "processing" && (
          <p className="text-xs text-muted-foreground animate-pulse">
            Exchanging tokens with Instagram...
          </p>
        )}

      </div>
    </div>
  );
};

export default InstagramCallback;
