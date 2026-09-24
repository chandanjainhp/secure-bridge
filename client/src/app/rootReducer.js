import { combineReducers } from '@reduxjs/toolkit';
import { authReducer } from '@/features/auth/state/authSlice';
import { projectsReducer } from '@/features/projects/state/projectsSlice';
import { uiReducer } from '@/app/uiSlice';
import apiKeyReducer from '@/features/api-key/state/apiKeySlice';
import usageReducer from '@/features/usage/state/usageSlice';

export const rootReducer = combineReducers({
  auth: authReducer,
  projects: projectsReducer,
  ui: uiReducer,
  apiKey: apiKeyReducer,
  usage: usageReducer,
});

