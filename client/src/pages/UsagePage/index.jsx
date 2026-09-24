import { useEffect } from 'react';
import { useUsageStore, UsageDashboard } from '@/features/usage';

export default function UsagePage() {
  const { fetchUsage, isLoading } = useUsageStore();

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">Usage</h1>
      <p className="text-muted-foreground mb-6">
        Monitor your message usage and limits.
      </p>
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      <UsageDashboard />
    </div>
  );
}
