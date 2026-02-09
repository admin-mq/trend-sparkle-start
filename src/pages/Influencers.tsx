import { useState } from "react";
import { Users, Search, X, Bookmark, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Influencer {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  followers: string;
  erPercent: string;
  engagement: string;
  audienceMatch: string;
  verified?: boolean;
}

const mockInfluencers: Influencer[] = [
  { id: "1", name: "Steph", handle: "@beautybystephmx", avatar: "", followers: "10k", erPercent: "20.86%", engagement: "2.1k", audienceMatch: "49.89%", verified: false },
  { id: "2", name: "Alissa Khan-Whelan", handle: "@alissakhanwhelan", avatar: "", followers: "10k", erPercent: "7.66%", engagement: "764", audienceMatch: "23.85%" },
  { id: "3", name: "sharonn.gg", handle: "@sharonn.gg", avatar: "", followers: "10k", erPercent: "32.01%", engagement: "3.2k", audienceMatch: "72.87%" },
  { id: "4", name: "AB", handle: "@annieb2a_", avatar: "", followers: "10k", erPercent: "8.12%", engagement: "810", audienceMatch: "79.99%" },
  { id: "5", name: "CATALEEYAHH", handle: "@cataleeyahh", avatar: "", followers: "10k", erPercent: "11.89%", engagement: "1.2k", audienceMatch: "57.33%", verified: true },
  { id: "6", name: "Ash Whiffin", handle: "@ash_whiffin", avatar: "", followers: "10k", erPercent: "5.26%", engagement: "524", audienceMatch: "33.11%" },
  { id: "7", name: "Maisy Williams", handle: "@maisywilliamsofficial", avatar: "", followers: "10k", erPercent: "6.36%", engagement: "634", audienceMatch: "77.04%" },
  { id: "8", name: "livvgdula", handle: "@livvgdula", avatar: "", followers: "10k", erPercent: "5.41%", engagement: "539", audienceMatch: "70.09%" },
  { id: "9", name: "HannahLouise", handle: "@hannaheastwoodd", avatar: "", followers: "10k", erPercent: "5.28%", engagement: "526", audienceMatch: "81.47%" },
  { id: "10", name: "Milly Rose", handle: "@millymp__", avatar: "", followers: "10k", erPercent: "52.75%", engagement: "5.3k", audienceMatch: "74.72%" },
];

const Influencers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [hideSaved, setHideSaved] = useState(false);
  const [locationFilters, setLocationFilters] = useState<string[]>(["United Kingdom"]);
  const [genderFilter, setGenderFilter] = useState<string>("female");
  const [ageFilter, setAgeFilter] = useState("any");
  const [languageFilter, setLanguageFilter] = useState("any");
  const [followersMin, setFollowersMin] = useState("5000");
  const [followersMax, setFollowersMax] = useState("10000");
  const [engagementRate, setEngagementRate] = useState("5");
  const [topicsFilter, setTopicsFilter] = useState("any");

  const removeLocation = (loc: string) => {
    setLocationFilters(locationFilters.filter((l) => l !== loc));
  };

  const clearGender = () => setGenderFilter("");

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* Left Filter Sidebar */}
      <div className="w-72 border-r border-border bg-card flex-shrink-0 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {/* Platform Tabs */}
            <Tabs value={platform} onValueChange={setPlatform}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="instagram" className="text-xs">Instagram</TabsTrigger>
                <TabsTrigger value="tiktok" className="text-xs">TikTok</TabsTrigger>
                <TabsTrigger value="youtube" className="text-xs">YouTube</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="@creator or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Email available</span>
                <Switch checked={emailAvailable} onCheckedChange={setEmailAvailable} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Hide saved profiles</span>
                <Switch checked={hideSaved} onCheckedChange={setHideSaved} />
              </div>
            </div>

            <Separator />

            {/* Demographics */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Demographics</h3>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Location</label>
                <div className="flex flex-wrap gap-1.5">
                  {locationFilters.map((loc) => (
                    <Badge key={loc} variant="secondary" className="text-xs gap-1 pr-1">
                      {loc}
                      <button onClick={() => removeLocation(loc)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Add location..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uk">United Kingdom</SelectItem>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="in">India</SelectItem>
                    <SelectItem value="ae">UAE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Gender</label>
                  {genderFilter && (
                    <button onClick={clearGender} className="text-xs text-primary hover:underline">Clear</button>
                  )}
                </div>
                {genderFilter ? (
                  <Badge variant="secondary" className="text-xs gap-1 pr-1">
                    {genderFilter.charAt(0).toUpperCase() + genderFilter.slice(1)}
                    <button onClick={clearGender} className="ml-0.5 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : (
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Age</label>
                <Select value={ageFilter} onValueChange={setAgeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="18-24">18–24</SelectItem>
                    <SelectItem value="25-34">25–34</SelectItem>
                    <SelectItem value="35-44">35–44</SelectItem>
                    <SelectItem value="45+">45+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Language</label>
                <Select value={languageFilter} onValueChange={setLanguageFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Performance */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Performance</h3>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Followers</label>
                  <button onClick={() => { setFollowersMin(""); setFollowersMax(""); }} className="text-xs text-primary hover:underline">Clear</button>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={followersMin} onChange={(e) => setFollowersMin(e.target.value)} className="h-8 text-xs" placeholder="From" />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input value={followersMax} onChange={(e) => setFollowersMax(e.target.value)} className="h-8 text-xs" placeholder="To" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Engagement rate</label>
                  <button onClick={() => setEngagementRate("")} className="text-xs text-primary hover:underline">Clear</button>
                </div>
                <Select value={engagementRate} onValueChange={setEngagementRate}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">≥1%</SelectItem>
                    <SelectItem value="3">≥3%</SelectItem>
                    <SelectItem value="5">≥5%</SelectItem>
                    <SelectItem value="10">≥10%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Views</label>
                <div className="flex items-center gap-2">
                  <Input className="h-8 text-xs" placeholder="From" />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input className="h-8 text-xs" placeholder="To" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Content */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Content</h3>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Topics</label>
                <Select value={topicsFilter} onValueChange={setTopicsFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="beauty">Beauty</SelectItem>
                    <SelectItem value="fashion">Fashion</SelectItem>
                    <SelectItem value="fitness">Fitness</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="tech">Tech</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Hashtags</label>
                <Select>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Mentions</label>
                <Select>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Right Content - Results Table */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Results Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50">
          <span className="text-sm text-muted-foreground font-medium">
            {mockInfluencers.length} profiles
          </span>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <button className="flex items-center gap-1 hover:text-foreground transition-colors">
              Followers ↕
            </button>
            <button className="flex items-center gap-1 hover:text-foreground transition-colors">
              ER% ↕
            </button>
            <button className="flex items-center gap-1 hover:text-foreground transition-colors">
              Engagement ↕
            </button>
            <button className="flex items-center gap-1 hover:text-foreground transition-colors">
              Audience Match ↕
            </button>
          </div>
        </div>

        {/* Results List */}
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {mockInfluencers.map((influencer) => (
              <div
                key={influencer.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors group"
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 min-w-[220px]">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={influencer.avatar} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                      {influencer.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate">{influencer.name}</span>
                      {influencer.verified && (
                        <span className="text-primary text-xs">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate block">{influencer.handle}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex-1 grid grid-cols-4 gap-4 text-center">
                  <span className="text-sm text-foreground">{influencer.followers}</span>
                  <span className="text-sm text-foreground">{influencer.erPercent}</span>
                  <span className="text-sm text-foreground">{influencer.engagement}</span>
                  <span className="text-sm text-foreground">{influencer.audienceMatch}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <Bookmark className="h-3 w-3" />
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <ExternalLink className="h-3 w-3" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default Influencers;
