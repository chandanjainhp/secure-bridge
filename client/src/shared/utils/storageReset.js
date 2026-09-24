/**
 * Storage Reset Utility
 * Feature-agnostic storage clearing functions
 * Does NOT import from @/features/*
 */

/**
 * Clear all persisted storage keys used by the app
 * WARNING: This is irreversible - all user data is lost
 */
export const clearAllStorage = () => {
  console.log(' [clearAllStorage] Clearing ALL localStorage keys...');

  // Zustand persist middleware creates keys with these patterns:
  // - auth-storage (authStore)
  // - projects-storage (projectsStore)
  // - ui-storage (uiStore)
  const persistedKeys = ['auth-storage', 'projects-storage', 'ui-storage', 'accessToken', 'refreshToken'];
  persistedKeys.forEach(key => {
    try {
      const existed = localStorage.getItem(key) !== null;
      localStorage.removeItem(key);
      if (existed) {
        console.log(`  Removed: ${key}`);
      }
    } catch (error) {
      console.error(`  Failed to remove ${key}:`, error);
    }
  });

  // Also clear sessionStorage as backup
  try {
    sessionStorage.clear();
    console.log('  Cleared sessionStorage');
  } catch (error) {
    console.error('  Failed to clear sessionStorage:', error);
  }
  console.log(' [clearAllStorage] All storage cleared');
};

export default {
  clearAllStorage
};
