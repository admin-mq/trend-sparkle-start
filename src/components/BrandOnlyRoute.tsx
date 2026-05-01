import { Navigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

interface BrandOnlyRouteProps {
  children: React.ReactNode;
}

export function BrandOnlyRoute({ children }: BrandOnlyRouteProps) {
  const { user, profile, loading } = useAuthContext();

  // Wait for auth to resolve before making a decision
  if (loading) return null;

  const accountType = profile?.account_type ?? user?.user_metadata?.account_type;

  if (accountType === 'creator') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
