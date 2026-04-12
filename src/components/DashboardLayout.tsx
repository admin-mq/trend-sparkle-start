import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import {
  LayoutDashboard,
  TrendingUp,
  Hash,
  Bookmark,
  Layers,
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
  Brain,
  X,
} from "lucide-react";
// Brain is still used for the Amcue nav item
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AmcueChat } from "@/components/amcue/AmcueChat";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MQLogo } from "@/components/MQLogo";

// ── Nav structure ─────────────────────────────────────────────────────────────

const navGroups = [
  {
    label: "Intelligence",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { path: "/trend-quest", label: "Trend Quest", icon: TrendingUp },
      { path: "/hashtag-analysis", label: "Hashtag Analysis", icon: Hash },
      { path: "/hashtag-watchlist",     label: "Watchlist",     icon: Bookmark },
      { path: "/hashtag-gap-analysis",  label: "Gap Analysis",  icon: Layers   },
      { path: "/trending-audios", label: "Trending Audios", icon: Music },
    ],
  },
  {
    label: "Execution",
    items: [
      { path: "/pr", label: "PR Campaigns", icon: Megaphone },
      { path: "/influencers", label: "Influencers", icon: Users },
      { path: "/paid-campaigns", label: "Paid Campaigns", icon: Target },
    ],
  },
  {
    label: "Analytics",
    items: [
      { path: "/seo", label: "SEO", icon: Search },
      { path: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

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

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (paths: string[]) => paths.some(p => location.pathname.startsWith(p));

  const NavItem = ({
    path,
    label,
    icon: Icon,
  }: {
    path: string;
    label: string;
    icon: React.ElementType;
  }) => {
    const active = isActive(path);
    return (
      <button
        onClick={() => { navigate(path); setSidebarOpen(false); }}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left",
          active
            ? "bg-primary/15 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 font-normal"
        )}
      >
        <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "")} />
        <span>{label}</span>
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
      </button>
    );
  };

  const displayName = sessionChecked
    ? (sessionEmail
        ? (profile?.brand_name || profile?.full_name || sessionEmail)
        : "Not logged in")
    : "…";

  return (
    <div className="min-h-screen bg-background flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-60 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>

        {/* Logo */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <MQLogo size={28} showBackground={true} />
            <span className="text-sm font-bold text-foreground tracking-tight">Marketers Quest</span>
          </div>
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amcue AI CMO — featured */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <button
            onClick={() => { navigate("/amcue"); setSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border",
              location.pathname.startsWith("/amcue")
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-primary/8 text-foreground border-primary/20 hover:bg-primary/12 hover:border-primary/35"
            )}
          >
            <Brain className="w-4 h-4 flex-shrink-0" />
            <span>Amcue AI CMO</span>
          </button>
        </div>

        <div className="mx-3 border-t border-border shrink-0" />

        {/* Nav groups */}
        <nav className="flex-1 px-3 pb-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="nav-group-label mt-3 mb-1">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.path} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom — Profile, Settings, Admin, Logout */}
        <div className="px-3 pb-3 pt-2 border-t border-border space-y-0.5 shrink-0">
          <NavItem path="/profile" label="Profile" icon={User} />
          <NavItem path="/settings" label="Settings" icon={Settings} />
          <NavItem path="/admin" label="Admin" icon={Shield} />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all mt-1"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card/60 shrink-0">
          {/* Mobile: hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Mobile: logo center */}
          <div className="flex lg:hidden items-center gap-2">
            <MQLogo size={24} showBackground={true} />
            <span className="text-sm font-bold">Marketers Quest</span>
          </div>

          {/* Desktop: user info */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
              <User className="w-3 h-3 text-primary" />
            </div>
            <span className="font-medium text-foreground">{displayName}</span>
            {sessionEmail && profile?.account_type && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/15 capitalize">
                {profile.account_type}
              </span>
            )}
          </div>

          {/* Right: theme toggle */}
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
