import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LogOut, Trash2, Shield, User, KeyRound, Eye, EyeOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Change password state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
      toast.error("No account email found.");
      return;
    }
    if (newPwd.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPwd === currentPwd) {
      toast.error("New password must be different from your current one.");
      return;
    }

    setChangingPwd(true);
    try {
      // 1. Verify the current password by re-signing-in (Supabase has no native verify call)
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPwd,
      });
      if (verifyErr) {
        toast.error("Current password is incorrect.");
        return;
      }

      // 2. Update to the new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd });
      if (updateErr) throw updateErr;

      // 3. Revoke every OTHER active session (other devices/browsers).
      // Current device stays signed in. Failure here is non-fatal — the
      // password is already changed; we just inform the user.
      const { error: revokeErr } = await supabase.auth.signOut({ scope: "others" });
      if (revokeErr) {
        console.warn("Could not revoke other sessions:", revokeErr);
        toast.success("Password updated. Other devices may take up to an hour to sign out.");
      } else {
        toast.success("Password updated. All other devices have been signed out.");
      }

      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      console.error("Change password error:", err);
      const msg = err instanceof Error ? err.message : "Could not update password.";
      toast.error(msg);
    } finally {
      setChangingPwd(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No active session');

      const { error } = await supabase.functions.invoke('handle-data-deletion', {
        body: { user_id: session.user.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      toast.success('Your account and all data have been permanently deleted.');
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Delete account error:', err);
      toast.error('Something went wrong. Please email contact@marketers.quest to request deletion.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email || '—'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Account ID</span>
            <span className="font-mono text-xs text-muted-foreground">{user?.id?.slice(0, 16)}…</span>
          </div>
          <div className="pt-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4" />
            Change password
          </CardTitle>
          <CardDescription>
            Use at least 8 characters. All other devices will be signed out — you'll stay signed in here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <Label htmlFor="current-pwd" className="text-sm">Current password</Label>
              <div className="relative">
                <Input
                  id="current-pwd"
                  type={showCurrent ? "text" : "password"}
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd" className="text-sm">New password</Label>
              <div className="relative">
                <Input
                  id="new-pwd"
                  type={showNew ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showNew ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPwd.length > 0 && newPwd.length < 8 && (
                <p className="text-xs text-destructive">Must be at least 8 characters.</p>
              )}
            </div>

            {/* Confirm new password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pwd" className="text-sm">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirm-pwd"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPwd.length > 0 && newPwd !== confirmPwd && (
                <p className="text-xs text-destructive">Passwords don't match.</p>
              )}
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                className="gap-2"
                disabled={
                  changingPwd ||
                  !currentPwd ||
                  newPwd.length < 8 ||
                  newPwd !== confirmPwd
                }
              >
                {changingPwd ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                Update password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Privacy & data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4" />
            Privacy & data
          </CardTitle>
          <CardDescription>
            Manage your personal data and privacy preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Privacy Policy</p>
              <p className="text-muted-foreground text-xs mt-0.5">How we collect and use your data</p>
            </div>
            <a
              href="https://marketers.quest/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-xs underline underline-offset-2"
            >
              View →
            </a>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Terms of Service</p>
              <p className="text-muted-foreground text-xs mt-0.5">Rules governing your use of the platform</p>
            </div>
            <a
              href="https://marketers.quest/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-xs underline underline-offset-2"
            >
              View →
            </a>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Data deletion request</p>
              <p className="text-muted-foreground text-xs mt-0.5">Request deletion of your data via email</p>
            </div>
            <a
              href="/data-deletion"
              className="text-primary text-xs underline underline-offset-2"
            >
              View →
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="w-4 h-4" />
            Danger zone
          </CardTitle>
          <CardDescription>
            These actions are permanent and cannot be undone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently delete your account and all associated data
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  className="gap-2"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account and all data including brand profiles,
                    AI recommendations, and content history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
