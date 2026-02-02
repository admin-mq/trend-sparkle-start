import { useAuthContext } from '@/contexts/AuthContext';
import { CompleteProfileDialog } from '@/components/CompleteProfileDialog';

export function ProfileCompletionWrapper() {
  const { user, needsProfileCompletion, setNeedsProfileCompletion } = useAuthContext();

  if (!user || !needsProfileCompletion) {
    return null;
  }

  return (
    <CompleteProfileDialog
      open={needsProfileCompletion}
      onClose={() => setNeedsProfileCompletion(false)}
      userId={user.id}
      userEmail={user.email || ''}
    />
  );
}
