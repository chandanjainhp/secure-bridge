import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { store } from '@/app/store';
import {
  patchUIState,
  persistUIState,
  setProjectSidebarOpen,
  setSidebarOpen,
  setTheme as setThemeAction,
  toggleProjectSidebar as toggleProjectSidebarAction,
  toggleSidebar as toggleSidebarAction,
} from '@/app/uiSlice';

const selectUI = state => state.ui;

const createActions = dispatch => ({
  setTheme: theme => {
    dispatch(setThemeAction(theme));
    persistUIState({ ...store.getState().ui, theme });
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    }
  },
  toggleSidebar: () => {
    dispatch(toggleSidebarAction());
    persistUIState(store.getState().ui);
  },
  setSidebarOpen: open => {
    dispatch(setSidebarOpen(open));
    persistUIState(store.getState().ui);
  },
  toggleProjectSidebar: () => {
    dispatch(toggleProjectSidebarAction());
    persistUIState(store.getState().ui);
  },
  setProjectSidebarOpen: open => {
    dispatch(setProjectSidebarOpen(open));
    persistUIState(store.getState().ui);
  },
});

export const useUIStore = selector => {
  const dispatch = useDispatch();
  const state = useSelector(selectUI);
  const actions = useMemo(() => createActions(dispatch), [dispatch]);
  const combined = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  return selector ? selector(combined) : combined;
};

useUIStore.getState = () => ({ ...store.getState().ui, ...createActions(store.dispatch) });
useUIStore.setState = partial => {
  store.dispatch(patchUIState(partial));
  persistUIState(store.getState().ui);
};

