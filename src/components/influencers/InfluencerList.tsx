import { useState } from "react";
import { Users, CheckCircle2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  return String(n);
}

function ShimmerRows() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
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

      // Fire notification non-blocking
      supabase.functions.invoke("send-connection-notification", {
        body: {
          influencer_name: influencer.name,
          influencer_username: influencer.username,
          brand_email: user.email,
          message: message.trim() || null,
        },
      }).catch(() => {/* best-effort */});

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
  // Track which influencer IDs have had requests sent this session
  const [requested, setRequested] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-3 border-b border-border bg-card/50">
          <Skeleton className="h-4 w-24" />
        </div>
        <ShimmerRows />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50">
          <span className="text-sm text-muted-foreground font-medium">
            {influencers.length} profile{influencers.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <span className="w-20 text-center">Followers</span>
            <span className="w-24 text-center">Niche</span>
            <span className="w-28 text-center">Geography</span>
            <span className="w-24 text-center">Barter</span>
            <span className="w-28 text-center"></span>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {influencers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Users className="h-10 w-10 opacity-40" />
              <p className="text-sm">No influencers found. Add your first one!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {influencers.map((inf) => {
                const hasRequested = requested.has(inf.id);
                return (
                  <div
                    key={inf.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors group"
                  >
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-3 min-w-[200px] flex-1">
                      <Avatar className="h-11 w-11">
                        {inf.avatar_url && <AvatarImage src={inf.avatar_url} alt={inf.name} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {inf.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground truncate block">{inf.name}</span>
                        <span className="text-xs text-muted-foreground truncate block">@{inf.username}</span>
                      </div>
                    </div>

                    {/* Followers */}
                    <span className="w-20 text-center text-sm text-foreground">
                      {formatFollowers(inf.followers)}
                    </span>

                    {/* Niche */}
                    <span className="w-24 text-center">
                      {inf.niche_audience ? (
                        <Badge variant="secondary" className="text-xs">{inf.niche_audience}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </span>

                    {/* Geography */}
                    <span className="w-28 text-center text-xs text-muted-foreground">
                      {inf.geography || "—"}
                    </span>

                    {/* Barter */}
                    <span className="w-24 text-center">
                      {inf.barter_open ? (
                        <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400">
                          Barter ✓
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </span>

                    {/* Connect */}
                    <span className="w-28 flex justify-center">
                      {hasRequested ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
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
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      <ConnectDialog
        influencer={connectTarget}
        onClose={() => setConnectTarget(null)}
        onSuccess={(id) => setRequested((prev) => new Set([...prev, id]))}
      />
    </>
  );
}
