import { useState } from "react";
import { Search, Edit2, Trash2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mockUsers = [
  { id: 1, name: "Sarah Chen", email: "sarah.chen@company.com", role: "Owner", status: "Active", lastLogin: "2 hours ago" },
  { id: 2, name: "Marcus Johnson", email: "marcus.j@company.com", role: "Admin", status: "Active", lastLogin: "1 day ago" },
  { id: 3, name: "Emily Rodriguez", email: "emily.r@company.com", role: "Manager", status: "Active", lastLogin: "3 hours ago" },
  { id: 4, name: "David Kim", email: "david.kim@company.com", role: "Creator", status: "Active", lastLogin: "5 hours ago" },
  { id: 5, name: "Lisa Thompson", email: "lisa.t@company.com", role: "Creator", status: "Inactive", lastLogin: "2 weeks ago" },
  { id: 6, name: "James Wilson", email: "james.w@company.com", role: "Viewer", status: "Active", lastLogin: "1 hour ago" },
  { id: 7, name: "Anna Kowalski", email: "anna.k@company.com", role: "Manager", status: "Active", lastLogin: "4 hours ago" },
  { id: 8, name: "Michael Brown", email: "michael.b@company.com", role: "Viewer", status: "Inactive", lastLogin: "1 month ago" },
];

const roleColors: Record<string, string> = {
  Owner: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Admin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Manager: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Creator: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Viewer: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const statusColors: Record<string, string> = {
  Active: "bg-green-500/20 text-green-400 border-green-500/30",
  Inactive: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function AdminUsersTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">User Management</h3>
          <p className="text-sm text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px] bg-background border-border">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="Owner">Owner</SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
            <SelectItem value="Manager">Manager</SelectItem>
            <SelectItem value="Creator">Creator</SelectItem>
            <SelectItem value="Viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">Name</TableHead>
              <TableHead className="text-muted-foreground font-medium">Email</TableHead>
              <TableHead className="text-muted-foreground font-medium">Role</TableHead>
              <TableHead className="text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground font-medium">Last Login</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} className="border-border">
                <TableCell className="font-medium text-foreground">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={roleColors[user.role]}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[user.status]}>
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.lastLogin}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
