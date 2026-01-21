import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  TrendingUp, 
  Lightbulb, 
  Star, 
  Wrench, 
  Clock,
  Sparkles,
  Plus,
  Hash,
  ArrowRight
} from "lucide-react";

// Mock data for dashboard
const kpiData = [
  { label: "Brands Managed", value: "3", context: "Active profiles", icon: Building2 },
  { label: "Trends Generated", value: "42", context: "Last 30 days", icon: TrendingUp },
  { label: "Content Ideas", value: "128", context: "Total created", icon: Lightbulb },
  { label: "Avg Engagement", value: "7.8", context: "Out of 10", icon: Star },
  { label: "Tools Used", value: "4", context: "Active tools", icon: Wrench },
  { label: "Last Activity", value: "2h", context: "ago", icon: Clock },
];

const toolUsage = [
  { name: "Trend Quest", percentage: 60, color: "bg-primary" },
  { name: "Hashtag Analysis", percentage: 20, color: "bg-accent" },
  { name: "Trending Audios", percentage: 8, color: "bg-chart-3" },
  { name: "SEO", percentage: 5, color: "bg-chart-4" },
  { name: "Influencers", percentage: 4, color: "bg-chart-5" },
  { name: "PR", percentage: 2, color: "bg-muted-foreground" },
  { name: "Paid Campaigns", percentage: 1, color: "bg-muted" },
];

const recentActivity = [
  { action: "Generated trends", tool: "Trend Quest", brand: "EcoTrace", time: "2h ago" },
  { action: "Created blueprint", tool: "Trend Quest", brand: "Instagram Reel", time: "3h ago" },
  { action: "Saved brand profile", tool: "Profile", brand: "EcoTrace", time: "5h ago" },
  { action: "Viewed", tool: "Trending Audios", brand: null, time: "1d ago" },
  { action: "Generated analysis", tool: "Hashtag Analysis", brand: null, time: "2d ago" },
];

const quickActions = [
  { label: "Generate Trends", path: "/trend-quest", icon: Sparkles, description: "Get AI-powered trend recommendations" },
  { label: "Add New Brand", path: "/profile", icon: Plus, description: "Create a new brand profile" },
  { label: "Explore Hashtags", path: "/hashtag-analysis", icon: Hash, description: "Analyze trending hashtags" },
];

const Dashboard = () => {
  return (
    <div className="h-full p-4 lg:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Your marketing performance at a glance</p>
          <p className="text-xs text-muted-foreground/70">Data shown is sample data for now</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiData.map((kpi) => (
            <Card key={kpi.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground/70">{kpi.context}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <kpi.icon className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Tool Usage Chart */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tool Usage Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {toolUsage.map((tool) => (
                <div key={tool.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{tool.name}</span>
                    <span className="text-muted-foreground">{tool.percentage}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${tool.color} rounded-full transition-all duration-500`}
                      style={{ width: `${tool.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {activity.action} {activity.brand && <span className="text-primary">{activity.brand}</span>}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{activity.tool}</span>
                      <span>•</span>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Link key={action.label} to={action.path}>
                <Card className="bg-card border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <action.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {action.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;