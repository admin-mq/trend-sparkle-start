import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProfileCompletionWrapper } from "@/components/ProfileCompletionWrapper";
import { DashboardLayout } from "@/components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import TrendQuest from "./pages/TrendQuest";
import HashtagAnalysis from "./pages/HashtagAnalysis";
import HashtagHistory from "./pages/HashtagHistory";
import HashtagWatchlist from "./pages/HashtagWatchlist";
import CreatorIntelligence from "./pages/CreatorIntelligence";
import InstagramCallback from "./pages/InstagramCallback";
import TrendingAudios from "./pages/TrendingAudios";
import SEO from "./pages/SEO";
import SEOResults from "./pages/SEOResults";
import Influencers from "./pages/Influencers";
import PR from "./pages/PR";
import PRResults from "./pages/PRResults";
import PRPrint from "./pages/PRPrint";
import Analytics from "./pages/Analytics";
import PaidCampaigns from "./pages/PaidCampaigns";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Debug from "./pages/Debug";
import FreeScan from "./pages/FreeScan";
import NotFound from "./pages/NotFound";
import Amcue from "./pages/Amcue";
import AmcueBrandProfile from "./pages/AmcueBrandProfile";
import DataDeletion from "./pages/DataDeletion";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ProfileCompletionWrapper />
          <Routes>
            {/* Public auth route */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/free-scan" element={<FreeScan />} />
            <Route path="/debug" element={<Debug />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Protected dashboard layout with nested routes */}
            <Route element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/trend-quest" element={<TrendQuest />} />
              <Route path="/hashtag-analysis" element={<HashtagAnalysis />} />
              <Route path="/hashtag-history" element={<HashtagHistory />} />
              <Route path="/hashtag-watchlist" element={<HashtagWatchlist />} />
              <Route path="/creator-intelligence" element={<CreatorIntelligence />} />
              <Route path="/trending-audios" element={<TrendingAudios />} />
              <Route path="/seo" element={<SEO />} />
              <Route path="/seo/results" element={<SEOResults />} />
              <Route path="/influencers" element={<Influencers />} />
              <Route path="/pr" element={<PR />} />
              <Route path="/pr/results" element={<PRResults />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/paid-campaigns" element={<PaidCampaigns />} />
              <Route path="/amcue" element={<Amcue />} />
              <Route path="/amcue/brand-profile" element={<AmcueBrandProfile />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
            
            {/* PR print report — protected but no sidebar */}
            <Route path="/pr/report" element={
              <ProtectedRoute><PRPrint /></ProtectedRoute>
            } />

            {/* Catch-all */}
            {/* Instagram OAuth callback — public, no sidebar */}
            <Route path="/instagram-callback" element={<InstagramCallback />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
