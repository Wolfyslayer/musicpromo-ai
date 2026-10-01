import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
  </div>
);

/**
 * Shell guard. Guests stay on the page they opened. Only an account that
 * exists but is not registered for this app is blocked. Premium actions
 * open the login modal through requireAuth instead of a route redirect.
 */
export default function ProtectedRoute({ fallback = <DefaultFallback /> }) {
  const { isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return <Outlet />;
}
