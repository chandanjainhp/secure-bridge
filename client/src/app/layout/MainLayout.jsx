import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth';
import { AppTopbar } from './AppTopbar';

export function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <div className="app-shell grid min-h-screen place-items-center"><div className="text-sm text-muted-foreground">Loading your workspace…</div></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell min-h-screen text-foreground">
      <AppTopbar />
      <main className="min-h-screen pt-16"><Outlet /></main>
    </div>
  );
}
