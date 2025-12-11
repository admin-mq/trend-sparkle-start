import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, LogOut, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function UserMenu() {
  const { user, loading, signInWithOtp, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    const { error } = await signInWithOtp(email);
    setSending(false);

    if (error) {
      toast.error(error.message || 'Failed to send login link');
    } else {
      setEmailSent(true);
      toast.success('Check your email for a login link!');
    }
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to log out');
    } else {
      toast.success('Logged out');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="w-4 h-4" />
          <span className="hidden sm:inline max-w-[150px] truncate">{user.email}</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Log out</span>
        </Button>
      </div>
    );
  }

  if (showLogin) {
    if (emailSent) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="w-4 h-4" />
          <span>Check your email!</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowLogin(false);
              setEmailSent(false);
              setEmail('');
            }}
          >
            Cancel
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleLogin} className="flex items-center gap-2">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 w-40 text-sm"
          disabled={sending}
        />
        <Button type="submit" size="sm" disabled={sending || !email.trim()}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send link'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowLogin(false)}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setShowLogin(true)}
      className="text-sm"
    >
      <User className="w-4 h-4 mr-1" />
      Log in
    </Button>
  );
}
