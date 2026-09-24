import { useEffect } from 'react';
import { useApiKeyStore, ApiKeySettings } from '@/features/api-key';

export default function ApiKeyPage() {
  const { fetchApiKey, isLoading } = useApiKeyStore();

  useEffect(() => {
    fetchApiKey();
  }, [fetchApiKey]);

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">API Key</h1>
      <p className="text-muted-foreground mb-6">
        Manage your API key for unlimited chat access.
      </p>
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      <ApiKeySettings />
    </div>
  );
}
