/**
 * Auth State Reset Utility
 * Feature-specific reset logic for auth store
 */

import { useAuthStore } from '../hooks/useAuthStore';

/**
 * Reset Auth Store to its initial state
 * This clears in-memory state immediately
 */
export const resetAuthStore = () => {
  console.log(' [resetAuthStore] Resetting auth store to defaults...');
  try {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
      loginMethod: null,
      otpMode: null,
      otpEmail: null,
      otpName: null,
      otpSent: false,
      registerName: null,
      registerEmail: null,
      registerOtpSent: false,
      _isHydrated: false
    });
    console.log(' [resetAuthStore] Auth store reset');
    return true;
  } catch (error) {
    console.error(' [resetAuthStore] Failed to reset auth store:', error);
    return false;
  }
};

/**
 * Get current auth state for validation
 */
export const getAuthState = () => {
  return useAuthStore.getState();
};

export default {
  resetAuthStore,
  getAuthState
};
