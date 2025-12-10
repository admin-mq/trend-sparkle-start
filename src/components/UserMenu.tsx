import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, ChevronDown } from 'lucide-react';

const planColors: Record<string, string> = {
  Free: 'bg-secondary text-secondary-foreground',
  Pro: 'bg-primary/20 text-primary',
  Premium: 'bg-accent/20 text-accent-foreground',
};

export const UserMenu = () => {
  const { user, plan, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="w-20 h-8 bg-secondary/50 rounded animate-pulse" />
    );
  }

  if (!user) {
    return (
      <Link to="/auth">
        <Button variant="outline" size="sm">
          <User className="w-4 h-4 mr-2" />
          Login
        </Button>
      </Link>
    );
  }

  const email = user.email || 'User';
  const displayEmail = email.length > 20 ? email.substring(0, 17) + '...' : email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="w-4 h-4" />
          <span className="hidden md:inline text-sm">{displayEmail}</span>
          <Badge className={`text-xs ${planColors[plan] || planColors.Free}`}>
            {plan}
          </Badge>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium truncate">{email}</p>
          <p className="text-xs text-muted-foreground">Current plan: {plan}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
