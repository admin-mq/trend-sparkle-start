import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import {
  LayoutDashboard,
  TrendingUp,
  Hash,
  Clock,
  Layers,
  Music,
  Search,
  Users,
  Megaphone,
  BarChart3,
  LineChart,
  Target,
  Settings,
  LogOut,
  Menu,
  User,
  Brain,
  X,
  Sparkles,
  ListChecks,
  DollarSign,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AmcueChat } from "@/components/amcue/AmcueChat";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MQLogo } from "@/components/MQLogo";

// ── Mobile bottom nav items ───────────────────────────────────────────────────

const mobileNavItems = [
  { path: "/dashboard",        label: "Home",       icon: LayoutDashboard },
  { path: "/trend-quest",      label: "Trends",     icon: TrendingUp },
  { path: "/tweet-drafts",     label: "Drafts",     icon: Sparkles },
  { path: "/hashtag-analysis", label: "Hashtags",   icon: Hash },
  { path: "/profile",          label: "Profile",    icon: User },
];

// ── Nav structure ─────────────────────────────────────────────────────────────

const brandNavGroups = [
  {
    label: "Intelligence",
    items: [
      { path: "/dashboard",            label: "Dashboard",        icon: LayoutDashboard },
      { path: "/trend-quest",          label: "Trend Quest",      icon: TrendingUp },
      { path: "/tweet-drafts",         label: "My Drafts",        icon: Sparkles },
      { path: "/hashtag-analysis",     label: "Hashtag Analysis", icon: Hash },
      { path: "/hashtag-watchlist",    label: "Watchlist",        icon: Clock },
      { path: "/hashtag-gap-analysis", label: "Tag Gap Finder",   icon: Layers },
      { path: "/trending-audios",      label: "Trending Audios",  icon: Music },
    ],
  },
  {
    label: "Execution",
    items: [
      { path: "/pr",            label: "PR Campaigns",  icon: Megaphone },
      { path: "/pr/todo",       label: "PR To-Do",      icon: ListChecks },
      { path: "/influencers",   label: "Influencers",   icon: Users },
      { path: "/paid-campaigns",label: "Paid Campaigns",icon: Target },
    ],
  },
  {
    label: "Analytics",
    items: [
      { path: "/seo",       label: "SEO",       icon: Search },
      { path: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
];

const creatorNavGroups = [
  {
    label: "Intelligence",
    items: [
      { path: "/dashboard",            label: "Dashboard",        icon: LayoutDashboard },
      { path: "/trend-quest",          label: "Trend Quest",      icon: TrendingUp },
      { path: "/tweet-drafts",         label: "My Drafts",        icon: Sparkles },
      { path: "/hashtag-analysis",     label: "Hashtag Analysis", icon: Hash },
      { path: "/hashtag-watchlist",    label: "Watchlist",        icon: Clock },
      { path: "/hashtag-gap-analysis", label: "Tag Gap Finder",   icon: Layers },
      { path: "/trending-audios",      label: "Trending Audios",  icon: Music },
      { path: "/creator-analysis",     label: "Analysis",         icon: LineChart },
      { path: "/brand-collab",          label: "Brand Collab",     icon: DollarSign },
      { path: "/creator-collab",        label: "Creator Collab",   icon: Eye },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() =>
    localStorage.getItem("mq_sidebar_collapsed") === "true"
  );
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuthContext();

  const toggleDesktop = () => {
    setDesktopCollapsed(prev => {
      localStorage.setItem("mq_sidebar_collapsed", String(!prev));
      return !prev;
    });
  };

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

  // Use profile as source of truth; fall back to auth user_metadata (set at signup)
  const accountType = profile?.account_type ?? user?.user_metadata?.account_type;
  const isCreator = accountType === "creator";
  const navGroups = isCreator ? creatorNavGroups : brandNavGroups;

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
        title={desktopCollapsed ? label : undefined}
        className={cn(
          "w-full flex items-center rounded-lg text-sm transition-all text-left",
          desktopCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2",
          active
            ? "bg-primary/15 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 font-normal"
        )}
      >
        <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "")} />
        {!desktopCollapsed && <span>{label}</span>}
        {!desktopCollapsed && active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
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

      {/* Mobile sidebar pill — center-left edge, only when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-card border border-l-0 border-border rounded-r-xl py-4 px-1.5 flex flex-col items-center gap-1.5 shadow-lg hover:bg-secondary transition-colors"
          aria-label="Open navigation"
        >
          <div className="w-0.5 h-4 bg-muted-foreground/40 rounded-full" />
          <div className="w-0.5 h-4 bg-muted-foreground/40 rounded-full" />
          <div className="w-0.5 h-4 bg-muted-foreground/40 rounded-full" />
        </button>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-card border-r border-border flex flex-col transition-all duration-200 ease-in-out",
        // Mobile: slide in/out
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        // Desktop: full or icon-only width
        desktopCollapsed ? "lg:w-14" : "lg:w-60",
        // Mobile always full width when open
        "w-60"
      )}>

        {/* Logo + collapse toggle */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-border shrink-0">
          {!desktopCollapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <MQLogo size={28} showBackground={true} />
              <span className="text-sm font-bold text-foreground tracking-tight whitespace-nowrap">Marketers Quest</span>
            </div>
          )}
          {desktopCollapsed && (
            <div className="w-full flex justify-center">
              <MQLogo size={28} showBackground={true} />
            </div>
          )}
          {/* Mobile close */}
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
          {/* Desktop collapse toggle */}
          <button
            onClick={toggleDesktop}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors flex-shrink-0"
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Amcue AI CMO — featured */}
        <div className={cn("pt-3 pb-2 shrink-0", desktopCollapsed ? "px-2" : "px-3")}>
          <button
            onClick={() => { navigate("/amcue"); setSidebarOpen(false); }}
            title={desktopCollapsed ? "Amcue AI CMO" : undefined}
            className={cn(
              "w-full flex items-center rounded-lg text-sm font-medium transition-all border",
              desktopCollapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5",
              location.pathname.startsWith("/amcue")
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-primary/8 text-foreground border-primary/20 hover:bg-primary/12 hover:border-primary/35"
            )}
          >
            <Brain className="w-4 h-4 flex-shrink-0" />
            {!desktopCollapsed && <span>Amcue AI CMO</span>}
          </button>
        </div>

        <div className={cn("border-t border-border shrink-0", desktopCollapsed ? "mx-2" : "mx-3")} />

        {/* Nav groups */}
        <nav className={cn("flex-1 pb-3 overflow-y-auto", desktopCollapsed ? "px-2" : "px-3")}>
          {authLoading ? (
            <div className="space-y-1.5 mt-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-8 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : navGroups.map((group) => (
            <div key={group.label}>
              {!desktopCollapsed && <p className="nav-group-label mt-3 mb-1">{group.label}</p>}
              {desktopCollapsed && <div className="mt-3" />}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.path} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom — Profile, Settings, Logout */}
        <div className={cn("pb-3 pt-2 border-t border-border space-y-0.5 shrink-0", desktopCollapsed ? "px-2" : "px-3")}>
          <NavItem path="/profile" label="Profile" icon={User} />
          <NavItem path="/settings" label="Settings" icon={Settings} />
          <button
            onClick={handleLogout}
            title={desktopCollapsed ? "Log out" : undefined}
            className={cn(
              "w-full flex items-center rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all mt-1",
              desktopCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2"
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!desktopCollapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-200",
        desktopCollapsed ? "lg:ml-14" : "lg:ml-60"
      )}>

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
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around px-1 py-1.5">
          {mobileNavItems.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0 flex-1",
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", active && "text-primary")} />
                <span className={cn("text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <AmcueChat />

    </div>
  );
};
