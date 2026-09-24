import { Toaster } from '@/shared/components/ui/toaster';
import { Toaster as Sonner } from '@/shared/components/ui/sonner';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { AppRouter } from '@/app/router';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 10 * 60_000, retry: 1 } } });

export default function App() {
  return <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider><Toaster/><Sonner/><AppRouter/></TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>;
}
