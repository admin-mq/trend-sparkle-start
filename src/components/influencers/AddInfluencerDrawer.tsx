import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NICHES = ["Beauty", "Fashion", "Fitness", "Food", "Travel", "Tech", "Lifestyle", "Gaming", "Music", "Education"];
const GEOGRAPHIES = ["United Kingdom", "United States", "India", "UAE", "Canada", "Australia", "Germany", "France", "Brazil", "Nigeria"];

interface Props {
  onSubmit: (values: { name: string; username: string; followers: number; niche_audience: string; geography: string }) => Promise<boolean>;
}

export function AddInfluencerDrawer({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", followers: "", niche_audience: "", geography: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.username) return;
    setSubmitting(true);
    const ok = await onSubmit({
      name: form.name,
      username: form.username.startsWith("@") ? form.username : `@${form.username}`,
      followers: parseInt(form.followers) || 0,
      niche_audience: form.niche_audience,
      geography: form.geography,
    });
    setSubmitting(false);
    if (ok) {
      setForm({ name: "", username: "", followers: "", niche_audience: "", geography: "" });
      setOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Influencer
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add New Influencer</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" placeholder="e.g. Jane Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username *</Label>
            <Input id="username" placeholder="@handle" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="followers">Followers</Label>
            <Input id="followers" type="number" min={0} placeholder="10000" value={form.followers} onChange={(e) => setForm({ ...form, followers: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Niche / Audience</Label>
            <Select value={form.niche_audience} onValueChange={(v) => setForm({ ...form, niche_audience: v })}>
              <SelectTrigger><SelectValue placeholder="Select niche" /></SelectTrigger>
              <SelectContent>
                {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Geography</Label>
            <Select value={form.geography} onValueChange={(v) => setForm({ ...form, geography: v })}>
              <SelectTrigger><SelectValue placeholder="Select geography" /></SelectTrigger>
              <SelectContent>
                {GEOGRAPHIES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={submitting || !form.name || !form.username}>
            {submitting ? "Adding..." : "Add Influencer"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
