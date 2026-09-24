import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'ui-storage';

const readPersistedState = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);
    return parsed.state || {};
  } catch {
    return {};
  }
};

const applyThemeClass = theme => {
  if (typeof window === 'undefined') {
    return;
  }

  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');
  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.classList.add(systemTheme);
    return;
  }
  root.classList.add(theme);
};

const persisted = readPersistedState();

const initialState = {
  theme: persisted.theme || 'dark',
  sidebarOpen: typeof persisted.sidebarOpen === 'boolean' ? persisted.sidebarOpen : true,
  projectSidebarOpen: typeof persisted.projectSidebarOpen === 'boolean' ? persisted.projectSidebarOpen : true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action) {
      state.theme = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action) {
      state.sidebarOpen = action.payload;
    },
    toggleProjectSidebar(state) {
      state.projectSidebarOpen = !state.projectSidebarOpen;
    },
    setProjectSidebarOpen(state, action) {
      state.projectSidebarOpen = action.payload;
    },
    patchUIState(state, action) {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  toggleProjectSidebar,
  setProjectSidebarOpen,
  patchUIState,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;

export const persistUIState = state => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      state: {
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        projectSidebarOpen: state.projectSidebarOpen,
      },
    }),
  );
};

export const initializeThemeClass = theme => {
  applyThemeClass(theme || initialState.theme);
};

