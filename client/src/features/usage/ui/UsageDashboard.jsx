import { useState, useEffect } from 'react';
import { Activity, Info, Infinity as InfinityIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import { Button } from '@/shared/components/ui/button';
import { useUsageStore } from '../hooks/useUsageStore';
import { useApiKeyStore } from '@/features/api-key';
import { fetchAvailableModels } from '@/features/chat/api/availableModels';

export function UsageDashboard() {
  const { used, remaining, limit, isLoading, fetchUsage } = useUsageStore();
  const { hasKey } = useApiKeyStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  // What the user can actually use — mirrors the backend rule: only the shared
  // free-tier model consumes quota; local LLM and BYOK are never charged.
  const [modelAccess, setModelAccess] = useState({ hasCloudKey: false, hasLocal: false, loading: true });

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    let cancelled = false;
    fetchAvailableModels().then((options) => {
      if (cancelled) return;
      setModelAccess({
        hasCloudKey: options.some((m) => m.value !== 'local'),
        hasLocal: options.some((m) => m.value === 'local'),
        loading: false,
      });
    });
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUsage();
    setIsRefreshing(false);
  };

  const isFreeTier = !hasKey && !modelAccess.hasCloudKey && !modelAccess.hasLocal;
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Usage & Limits
        </CardTitle>
        <CardDescription>
          Track your message usage and model access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {modelAccess.loading ? (
          <p className="text-xs text-muted-foreground">Checking model access…</p>
        ) : isFreeTier ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Free Messages</p>
                <p className="text-xs text-muted-foreground">{remaining} of {limit} remaining</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || isLoading}>
                {isRefreshing || isLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>

            <div className="space-y-2">
              <Progress value={percentage} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{used} used</span>
                <span>{remaining} remaining</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Messages</p>
                <p className="text-xs text-muted-foreground">Unlimited on your configured model</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || isLoading}>
                {isRefreshing || isLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              {modelAccess.hasCloudKey ? (
                <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
              ) : (
                <InfinityIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-xs text-muted-foreground">
                {modelAccess.hasCloudKey
                  ? 'You are using your own API key. Messages are unlimited and processed directly via your provider.'
                  : 'You are using your local LLM server. Messages are unlimited and never consume the free-tier quota.'}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
