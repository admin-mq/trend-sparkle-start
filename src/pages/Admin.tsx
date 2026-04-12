import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminUsageTab } from "@/components/admin/AdminUsageTab";
import { AdminSettingsTab } from "@/components/admin/AdminSettingsTab";

const Admin = () => {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage team, usage, and platform settings</p>
        </div>
        <Badge variant="outline" className="w-fit bg-purple-500/20 text-purple-400 border-purple-500/30">
          Beta
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border p-1 h-auto">
          <TabsTrigger
            value="users"
            className="px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Users & Teams
          </TabsTrigger>
          <TabsTrigger
            value="usage"
            className="px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Usage & Logs
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            System Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <AdminUsersTab />
        </TabsContent>

        <TabsContent value="usage" className="mt-6">
          <AdminUsageTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <AdminSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
