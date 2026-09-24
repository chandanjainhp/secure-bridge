/**
 * App Initialization
 * Sets up cross-cutting concerns like error handlers
 */

import { apiClient } from '@/shared/api/client';
import { resetProjectsData } from '@/features/projects/utils/projectsReset';

/**
 * Initialize the application
 * Register error handlers and other cross-cutting concerns
 */
export const initApp = () => {
  console.log(' [init] Initializing app...');

  // Register auth error handler to reset projects data on 401/403
  apiClient.registerAuthErrorHandler((status, endpoint) => {
    console.log(` [init] Auth error handler triggered (${status}) for endpoint: ${endpoint}`);
    resetProjectsData(`api_${status}`);
  });

  console.log(' [init] App initialized');
};
