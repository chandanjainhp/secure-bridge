/**
 * Projects State Reset Utility
 * Feature-specific reset logic for projects store
 */

import { useProjectsStore } from '../hooks/useProjectsStore';

/**
 * Reset Projects Store to its initial state
 * This clears in-memory state immediately
 */
export const resetProjectsStore = () => {
  console.log(' [resetProjectsStore] Resetting projects store to defaults...');
  try {
    useProjectsStore.setState({
      projects: [],
      currentProject: null,
      conversations: [],
      currentConversation: null,
      isLoading: false
    });
    console.log(' [resetProjectsStore] Projects store reset');
    return true;
  } catch (error) {
    console.error(' [resetProjectsStore] Failed to reset projects store:', error);
    return false;
  }
};

/**
 * Soft reset: Clear only project/conversation data
 * Keep auth state (user remains logged in)
 * 
 * Use when: Backend returns empty projects list or 401/403
 */
export const resetProjectsData = (reason = 'manual') => {
  console.log(' [resetProjectsData] Clearing projects and conversations...');
  console.log(`   Reason: ${reason}`);
  try {
    useProjectsStore.setState({
      projects: [],
      currentProject: null,
      conversations: [],
      currentConversation: null,
      isLoading: false
    });
    console.log(' [resetProjectsData] Projects data cleared');
    return true;
  } catch (error) {
    console.error(' [resetProjectsData] Failed:', error);
    return false;
  }
};

/**
 * Get current projects state for validation
 */
export const getProjectsState = () => {
  return useProjectsStore.getState();
};

export default {
  resetProjectsStore,
  resetProjectsData,
  getProjectsState
};
