import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import TrendQuest from "./pages/TrendQuest";
import HashtagAnalysis from "./pages/HashtagAnalysis";
import TrendingAudios from "./pages/TrendingAudios";
import SEO from "./pages/SEO";
import Influencers from "./pages/Influencers";
import PR from "./pages/PR";
import Analytics from "./pages/Analytics";
import PaidCampaigns from "./pages/PaidCampaigns";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Redirect root to trend-quest */}
          <Route path="/" element={<Navigate to="/trend-quest" replace />} />
          
          {/* Dashboard layout with nested routes */}
          <Route element={<DashboardLayout />}>
            <Route path="/trend-quest" element={<TrendQuest />} />
            <Route path="/hashtag-analysis" element={<HashtagAnalysis />} />
            <Route path="/trending-audios" element={<TrendingAudios />} />
            <Route path="/seo" element={<SEO />} />
            <Route path="/influencers" element={<Influencers />} />
            <Route path="/pr" element={<PR />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/paid-campaigns" element={<PaidCampaigns />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
