import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { 
  LayoutDashboard,
  TrendingUp, 
  Hash, 
  Music, 
  Search, 
  Users, 
  Megaphone, 
  BarChart3, 
  Target,
  Settings,
  Shield,
  LogOut,
  Menu,
  User,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AmcueChat } from "@/components/amcue/AmcueChat";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mainNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/trend-quest", label: "Trend Quest", icon: TrendingUp },
  { path: "/hashtag-analysis", label: "Hashtag Analysis", icon: Hash },
  { path: "/trending-audios", label: "Trending Audios", icon: Music },
  { path: "/seo", label: "SEO", icon: Search },
  { path: "/influencers", label: "Influencers", icon: Users },
  { path: "/pr", label: "PR", icon: Megaphone },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/paid-campaigns", label: "Paid Campaigns", icon: Target },
];

const bottomNavItems = [
  { path: "/profile", label: "Profile", icon: User },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/admin", label: "Admin", icon: Shield },
];

export const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuthContext();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionEmail(session?.user?.email ?? null);
      setSessionChecked(true);
    });
  }, []);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Failed to logout");
    } else {
      toast.success("Logged out successfully");
      navigate("/auth");
    }
  };

  const NavItem = ({ path, label, icon: Icon }: { path: string; label: string; icon: React.ElementType }) => {
    const isActive = location.pathname === path;
    return (
      <button
        onClick={() => {
          navigate(path);
          setSidebarOpen(false);
        }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
          isActive 
            ? "bg-primary text-primary-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{label}</span>
      </button>
    );
  };

  // Display name: only show if session is confirmed
  const displayName = sessionChecked
    ? (sessionEmail ? (profile?.brand_name || profile?.full_name || sessionEmail) : 'Not logged in')
    : '...';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Marketers Quest</h1>
              <p className="text-[10px] text-muted-foreground">Marketing Tools Hub</p>
            </div>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {mainNavItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-border space-y-1">
          {bottomNavItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
          
          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between p-3 border-b border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">Marketers Quest</span>
          </div>
          <ThemeToggle />
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex items-center justify-between gap-3 p-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>Logged in as <span className="font-medium text-foreground">{displayName}</span></span>
            {sessionEmail && profile?.account_type && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize">
                {profile.account_type}
              </span>
            )}
          </div>
          <ThemeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <AmcueChat />
    </div>
  );
};
