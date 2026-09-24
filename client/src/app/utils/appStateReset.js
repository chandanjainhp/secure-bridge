/**
 * App-Level State Reset Utility
 * Orchestrates reset across multiple features
 * This is app-level coordination, not shared infrastructure
 */

import { clearAllStorage } from '@/shared/utils/storageReset';
import { resetAuthStore, getAuthState } from '@/features/auth/utils/authReset';
import { resetProjectsStore, getProjectsState, resetProjectsData as projectsResetData } from '@/features/projects/utils/projectsReset';

/**
 * Reset all Zustand stores to their initial state
 * This clears in-memory state immediately
 */
export const resetAllStores = () => {
  console.log(' [resetAllStores] Resetting all Zustand stores to defaults...');

  // Reset Auth Store
  try {
    resetAuthStore();
    console.log(' [resetAllStores] Auth store reset');
  } catch (error) {
    console.error(' [resetAllStores] Failed to reset auth store:', error);
  }

  // Reset Projects Store
  try {
    resetProjectsStore();
    console.log(' [resetAllStores] Projects store reset');
  } catch (error) {
    console.error(' [resetAllStores] Failed to reset projects store:', error);
  }

  console.log(' [resetAllStores] All stores reset');
};

/**
 * MAIN: Complete app state reset
 * 
 * Call this function to:
 * 1. Clear all persisted storage (localStorage, sessionStorage)
 * 2. Reset all Zustand stores to defaults
 * 3. Ready app for fresh login or database reload
 * 
 * Safe to call multiple times - idempotent operation
 */
export const resetAppState = (reason = 'manual') => {
  console.log('========================================');
  console.log(` [resetAppState] RESETTING APP STATE`);
  console.log(`   Reason: ${reason}`);
  console.log('========================================');
  try {
    // Step 1: Clear all storage
    clearAllStorage();

    // Step 2: Reset all stores
    resetAllStores();

    // Step 3: Verify clean state
    const authState = getAuthState();
    const projectsState = getProjectsState();
    const isClean = !authState.user && !authState.isAuthenticated && !authState.accessToken && projectsState.projects.length === 0 && projectsState.conversations.length === 0;
    if (isClean) {
      console.log(' [resetAppState] RESET COMPLETE - App is now in clean state');
      console.log('========================================');
      return true;
    } else {
      console.warn(' [resetAppState] Warning: App state not fully clean after reset');
      console.log('   Auth state:', {
        user: !!authState.user,
        isAuthenticated: authState.isAuthenticated,
        hasToken: !!authState.accessToken
      });
      console.log('   Projects state:', {
        projectCount: projectsState.projects.length,
        conversationCount: projectsState.conversations.length
      });
      return false;
    }
  } catch (error) {
    console.error(' [resetAppState] RESET FAILED:', error);
    console.log('========================================');
    throw error;
  }
};

/**
 * Soft reset: Clear only project/conversation data
 * Keep auth state (user remains logged in)
 * 
 * Use when: Backend returns empty projects list
 */
export const resetProjectsData = (reason = 'manual') => {
  return projectsResetData(reason);
};

/**
 * CRITICAL: Check if stored data matches backend reality
 * If backend returns empty but client has data, data is stale
 */
export const validateStoredState = () => {
  console.log(' [validateStoredState] Checking for stale data...');
  const authState = getAuthState();
  const projectsState = getProjectsState();
  const issues = [];

  // Check 1: User authenticated but no token
  if (authState.isAuthenticated && !authState.accessToken) {
    issues.push('Authentication state mismatch: authenticated but no token');
  }

  // Check 2: User authenticated but no user data
  if (authState.isAuthenticated && !authState.user) {
    issues.push('Authentication state mismatch: authenticated but no user');
  }

  // Check 3: Projects exist but backend will return empty
  if (projectsState.projects.length > 0 && !authState.isAuthenticated) {
    issues.push('Stale data: projects cached but user not authenticated');
  }

  // Check 4: Conversations exist but no current project
  if (projectsState.conversations.length > 0 && !projectsState.currentProject) {
    issues.push('Stale data: conversations cached but no current project');
  }
  if (issues.length === 0) {
    console.log(' [validateStoredState] No state issues detected');
    return {
      valid: true,
      issues: []
    };
  } else {
    console.warn(' [validateStoredState] Issues found:', issues);
    return {
      valid: false,
      issues
    };
  }
};

export default {
  resetAppState,
  resetProjectsData,
  clearAllStorage,
  resetAllStores,
  validateStoredState
};
