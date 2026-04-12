import { useState } from "react";
import { Users, CheckCircle2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Influencer } from "@/hooks/useInfluencers";

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n > 0 ? String(n) : "—";
}

function ShimmerRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3"><Skeleton className="h-3.5 w-12 mx-auto" /></td>
          <td className="px-4 py-3"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-5 w-14 mx-auto rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-7 w-20 mx-auto rounded-md" /></td>
        </tr>
      ))}
    </>
  );
}

// ── Connect Dialog ─────────────────────────────────────────────────────────────

interface ConnectDialogProps {
  influencer: Influencer | null;
  onClose: () => void;
  onSuccess: (influencerId: string) => void;
}

function ConnectDialog({ influencer, onClose, onSuccess }: ConnectDialogProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!influencer) return null;

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("connection_requests").insert({
        brand_id: user.id,
        brand_email: user.email,
        influencer_id: influencer.id,
        message: message.trim() || null,
        status: "pending",
      });
      if (error) throw error;

      supabase.functions.invoke("send-connection-notification", {
        body: {
          influencer_name: influencer.name,
          influencer_username: influencer.username,
          brand_email: user.email,
          message: message.trim() || null,
        },
      }).catch(() => {});

      toast.success(`Connection request sent to ${influencer.name}!`);
      onSuccess(influencer.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("You've already sent a request to this creator.");
      } else {
        toast.error("Failed to send request. Please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect with {influencer.name}</DialogTitle>
          <DialogDescription>
            Send a collaboration request to @{influencer.username}. Our team will follow up.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 py-2">
          <Avatar className="h-12 w-12">
            {influencer.avatar_url && <AvatarImage src={influencer.avatar_url} />}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {influencer.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{influencer.name}</p>
            <p className="text-sm text-muted-foreground">
              @{influencer.username} · {formatFollowers(influencer.followers)} followers
            </p>
          </div>
        </div>

        <Textarea
          placeholder="Add a message for the creator (optional)…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="resize-none"
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── InfluencerList ─────────────────────────────────────────────────────────────

interface Props {
  influencers: Influencer[];
  loading: boolean;
}

export function InfluencerList({ influencers, loading }: Props) {
  const { user } = useAuth();
  const [connectTarget, setConnectTarget] = useState<Influencer | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Count bar */}
        <div className="px-5 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <span className="text-sm text-muted-foreground font-medium">
            {loading ? "Loading…" : `${influencers.length} profile${influencers.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Scrollable table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 sticky top-0 z-10">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Creator</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-24">Followers</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-32">Niche</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-24">Barter</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-28"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <ShimmerRows />
              ) : influencers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                      <Users className="h-10 w-10 opacity-40" />
                      <p className="text-sm">No influencers found. Add your first one!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                influencers.map((inf) => {
                  const hasRequested = requested.has(inf.id);
                  return (
                    <tr
                      key={inf.id}
                      className="border-b border-border hover:bg-secondary/30 transition-colors"
                    >
                      {/* Creator */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            {inf.avatar_url && <AvatarImage src={inf.avatar_url} alt={inf.name} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                              {inf.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{inf.name}</p>
                            <p className="text-xs text-muted-foreground truncate">@{inf.username}</p>
                          </div>
                        </div>
                      </td>

                      {/* Followers */}
                      <td className="px-4 py-3 text-center text-sm text-foreground tabular-nums">
                        {formatFollowers(inf.followers)}
                      </td>

                      {/* Niche */}
                      <td className="px-4 py-3 text-center">
                        {inf.niche_audience ? (
                          <Badge variant="secondary" className="text-xs">{inf.niche_audience}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Barter */}
                      <td className="px-4 py-3 text-center">
                        {inf.barter_open ? (
                          <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400">
                            Barter ✓
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Connect */}
                      <td className="px-4 py-3 text-center">
                        {hasRequested ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Requested
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/10"
                            onClick={() => user && setConnectTarget(inf)}
                          >
                            Connect
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConnectDialog
        influencer={connectTarget}
        onClose={() => setConnectTarget(null)}
        onSuccess={(id) => setRequested((prev) => new Set([...prev, id]))}
      />
    </>
  );
}
