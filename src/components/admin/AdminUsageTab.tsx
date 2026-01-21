import { Activity, DollarSign, Zap, AlertTriangle, Eye, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statsCards = [
  {
    title: "OpenAI Usage (Month)",
    value: "12,847",
    subtitle: "API calls",
    icon: Activity,
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    title: "Estimated Cost",
    value: "$127.43",
    subtitle: "This billing cycle",
    icon: DollarSign,
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    title: "Most Used Tool",
    value: "Trend Quest",
    subtitle: "8,234 requests",
    icon: Zap,
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
  },
  {
    title: "Errors (7d)",
    value: "23",
    subtitle: "3.2% error rate",
    icon: AlertTriangle,
    iconBg: "bg-red-500/20",
    iconColor: "text-red-400",
  },
];

const mockLogs = [
  { id: 1, level: "INFO", message: "User sarah.chen@company.com logged in", user: "sarah.chen@company.com", timestamp: "2024-01-21 14:32:05" },
  { id: 2, level: "INFO", message: "Trend analysis completed for brand 'TechCorp'", user: "marcus.j@company.com", timestamp: "2024-01-21 14:28:12" },
  { id: 3, level: "WARNING", message: "Rate limit approaching (85% of quota)", user: "System", timestamp: "2024-01-21 14:15:00" },
  { id: 4, level: "ERROR", message: "Failed to generate blueprint: API timeout", user: "emily.r@company.com", timestamp: "2024-01-21 13:58:33" },
  { id: 5, level: "INFO", message: "New user david.kim@company.com created", user: "Admin", timestamp: "2024-01-21 13:45:10" },
  { id: 6, level: "INFO", message: "Creative directions generated successfully", user: "david.kim@company.com", timestamp: "2024-01-21 13:30:22" },
  { id: 7, level: "WARNING", message: "Session expired for user lisa.t@company.com", user: "System", timestamp: "2024-01-21 12:15:00" },
  { id: 8, level: "ERROR", message: "Database connection timeout", user: "System", timestamp: "2024-01-21 11:42:18" },
];

const levelColors: Record<string, string> = {
  INFO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  WARNING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ERROR: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function AdminUsageTab() {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${stat.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Logs Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">System Logs</h3>
            <p className="text-sm text-muted-foreground">Recent activity and error logs</p>
          </div>
          <Button variant="outline" className="gap-2 border-border">
            <Download className="h-4 w-4" />
            Export Logs
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium w-[100px]">Level</TableHead>
                <TableHead className="text-muted-foreground font-medium">Message</TableHead>
                <TableHead className="text-muted-foreground font-medium">User</TableHead>
                <TableHead className="text-muted-foreground font-medium">Timestamp</TableHead>
                <TableHead className="text-muted-foreground font-medium text-right w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLogs.map((log) => (
                <TableRow key={log.id} className="border-border">
                  <TableCell>
                    <Badge variant="outline" className={levelColors[log.level]}>
                      {log.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground max-w-md truncate">{log.message}</TableCell>
                  <TableCell className="text-muted-foreground">{log.user}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{log.timestamp}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
