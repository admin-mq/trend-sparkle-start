import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { InfluencerFilters as Filters } from "@/hooks/useInfluencers";

const NICHES = ["Beauty", "Fashion", "Fitness", "Food", "Travel", "Tech", "Lifestyle", "Gaming", "Music", "Education"];
const GEOGRAPHIES = ["United Kingdom", "United States", "India", "UAE", "Canada", "Australia", "Germany", "France", "Brazil", "Nigeria"];

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

export function InfluencerFilters({ filters, onChange }: Props) {
  const set = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });

  return (
    <div className="w-72 border-r border-border bg-card flex-shrink-0 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or @handle"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          <Separator />

          {/* Niche */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Niche / Audience</h3>
              {filters.niche && filters.niche !== "any" && (
                <button onClick={() => set("niche", "any")} className="text-xs text-primary hover:underline">Clear</button>
              )}
            </div>
            {filters.niche && filters.niche !== "any" ? (
              <Badge variant="secondary" className="text-xs gap-1 pr-1">
                {filters.niche}
                <button onClick={() => set("niche", "any")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ) : (
              <Select value={filters.niche} onValueChange={(v) => set("niche", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          {/* Geography */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Geography</h3>
              {filters.geography && filters.geography !== "any" && (
                <button onClick={() => set("geography", "any")} className="text-xs text-primary hover:underline">Clear</button>
              )}
            </div>
            {filters.geography && filters.geography !== "any" ? (
              <Badge variant="secondary" className="text-xs gap-1 pr-1">
                {filters.geography}
                <button onClick={() => set("geography", "any")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ) : (
              <Select value={filters.geography} onValueChange={(v) => set("geography", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {GEOGRAPHIES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          {/* Followers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Followers</h3>
              {(filters.followersMin || filters.followersMax) && (
                <button onClick={() => onChange({ ...filters, followersMin: "", followersMax: "" })} className="text-xs text-primary hover:underline">Clear</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input value={filters.followersMin} onChange={(e) => set("followersMin", e.target.value)} className="h-8 text-xs" placeholder="Min" type="number" />
              <span className="text-xs text-muted-foreground">–</span>
              <Input value={filters.followersMax} onChange={(e) => set("followersMax", e.target.value)} className="h-8 text-xs" placeholder="Max" type="number" />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
