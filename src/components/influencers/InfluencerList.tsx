import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
        </div>
      ))}
    </div>
  );
}

interface Props {
  influencers: Influencer[];
  loading: boolean;
}

export function InfluencerList({ influencers, loading }: Props) {
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
            {influencers.map((inf) => (
              <div
                key={inf.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors group cursor-pointer"
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 min-w-[200px] flex-1">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {inf.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">{inf.name}</span>
                    <span className="text-xs text-muted-foreground truncate block">{inf.username}</span>
                  </div>
                </div>

                {/* Stats */}
                <span className="w-20 text-center text-sm text-foreground">{formatFollowers(inf.followers)}</span>
                <span className="w-24 text-center">
                  {inf.niche_audience ? (
                    <Badge variant="secondary" className="text-xs">{inf.niche_audience}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </span>
                <span className="w-28 text-center text-xs text-muted-foreground">{inf.geography || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
