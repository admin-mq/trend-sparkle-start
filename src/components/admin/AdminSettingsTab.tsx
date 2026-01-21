import { useState } from "react";
import { Settings, Shield, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AdminSettingsTab() {
  const [dataRetention, setDataRetention] = useState("90");
  const [timezone, setTimezone] = useState("utc");
  const [exportFormat, setExportFormat] = useState("pdf");
  const [require2FA, setRequire2FA] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* System Configuration Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Settings className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">System Configuration</CardTitle>
              <CardDescription>Manage platform-wide settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="data-retention" className="text-sm text-foreground">
              Data Retention Period
            </Label>
            <Select value={dataRetention} onValueChange={setDataRetention}>
              <SelectTrigger id="data-retention" className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">How long to retain usage logs and analytics data</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-sm text-foreground">
              Default Timezone
            </Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="utc">UTC</SelectItem>
                <SelectItem value="local">Local (Browser)</SelectItem>
                <SelectItem value="est">Eastern Time (EST)</SelectItem>
                <SelectItem value="pst">Pacific Time (PST)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Timezone used for displaying logs and reports</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="export-format" className="text-sm text-foreground">
              Default Export Format
            </Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger id="export-format" className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="txt">Text</SelectItem>
                <SelectItem value="doc">Word Document</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Default format when exporting reports</p>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Security Settings</CardTitle>
              <CardDescription>Configure authentication and security options</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="2fa-toggle" className="text-sm text-foreground">
                Require 2FA for Admins
              </Label>
              <p className="text-xs text-muted-foreground">
                Force two-factor authentication for all admin accounts
              </p>
            </div>
            <Switch
              id="2fa-toggle"
              checked={require2FA}
              onCheckedChange={setRequire2FA}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-timeout" className="text-sm text-foreground">
              Session Timeout
            </Label>
            <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
              <SelectTrigger id="session-timeout" className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Auto-logout after inactivity period</p>
          </div>

          <div className="pt-4 border-t border-border">
            <Button variant="destructive" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset Security Settings
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              This will reset all security settings to their defaults
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
