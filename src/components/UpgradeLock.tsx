import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Lock, Crown } from 'lucide-react';

interface UpgradeLockProps {
  message?: string;
}

export const UpgradeLock = ({ message = "Upgrade to Pro to unlock this feature" }: UpgradeLockProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 rounded-lg bg-secondary/30 border border-border/50 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      <Link to="/auth">
        <Button size="sm" className="gap-2">
          <Crown className="w-4 h-4" />
          Upgrade to Pro
        </Button>
      </Link>
    </div>
  );
};

interface LockedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg";
}

export const LockedButton = ({ children, className, variant = "default", size = "default" }: LockedButtonProps) => {
  return (
    <Link to="/auth" className={className}>
      <Button variant={variant} size={size} className="gap-2 opacity-80">
        <Lock className="w-3 h-3" />
        {children}
      </Button>
    </Link>
  );
};
