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
import TrendingAudios from "./pages/TrendingAudios";
import SEO from "./pages/SEO";
import SEOResults from "./pages/SEOResults";
import Influencers from "./pages/Influencers";
import PR from "./pages/PR";
import Analytics from "./pages/Analytics";
import PaidCampaigns from "./pages/PaidCampaigns";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Debug from "./pages/Debug";
import FreeScan from "./pages/FreeScan";
import NotFound from "./pages/NotFound";

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
              <Route path="/trending-audios" element={<TrendingAudios />} />
              <Route path="/seo" element={<SEO />} />
              <Route path="/seo/results" element={<SEOResults />} />
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
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
