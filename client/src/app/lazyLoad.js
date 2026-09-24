import { lazy } from 'react';

const RETRY_KEY_PREFIX = 'secure-bridge:lazy-retry:';

function isChunkLoadError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('chunkloaderror') ||
    message.includes('loading chunk')
  );
}

/**
 * Lazy-load a route with one automatic recovery attempt for stale deploy chunks.
 * A successful import clears the retry marker. A failed retry surfaces the error
 * to the application's ErrorBoundary instead of looping forever.
 */
export function lazyLoad(importer, chunkName) {
  return lazy(async () => {
    try {
      const module = await importer();
      sessionStorage.removeItem(`${RETRY_KEY_PREFIX}${chunkName}`);
      return module;
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;

      const key = `${RETRY_KEY_PREFIX}${chunkName}`;
      const alreadyRetried = sessionStorage.getItem(key) === '1';

      if (alreadyRetried) throw error;

      sessionStorage.setItem(key, '1');
      window.location.reload();

      // Keep React.lazy suspended until the reload completes.
      return new Promise(() => {});
    }
  });
}
