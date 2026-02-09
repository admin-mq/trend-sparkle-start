import { useState } from "react";
import { useInfluencers, type InfluencerFilters } from "@/hooks/useInfluencers";
import { InfluencerFilters as FiltersSidebar } from "@/components/influencers/InfluencerFilters";
import { InfluencerList } from "@/components/influencers/InfluencerList";
import { AddInfluencerDrawer } from "@/components/influencers/AddInfluencerDrawer";

const Influencers = () => {
  const [filters, setFilters] = useState<InfluencerFilters>({
    search: "",
    niche: "any",
    geography: "any",
    followersMin: "",
    followersMax: "",
  });

  const { influencers, loading, addInfluencer } = useInfluencers(filters);

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      <FiltersSidebar filters={filters} onChange={setFilters} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with Add button */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Influencers</h2>
          <AddInfluencerDrawer onSubmit={addInfluencer} />
        </div>
        <InfluencerList influencers={influencers} loading={loading} />
      </div>
    </div>
  );
};

export default Influencers;
