import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { usageApi } from '../api/usageApi';

const STORAGE_KEY = 'usage-storage';

const readPersistedState = () => {
  if (typeof window === 'undefined') {
    return {};
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed.state || {};
  } catch {
    return {};
  }
};

const persisted = readPersistedState();

const initialState = {
  used: persisted.used || 0,
  remaining: persisted.remaining || 10,
  limit: persisted.limit || 10,
  isLoading: false,
  error: null,
};

export const fetchUsageThunk = createAsyncThunk('usage/fetchUsage', async (_, { rejectWithValue }) => {
  try {
    return await usageApi.getUsage();
  } catch (error) {
    return rejectWithValue(error.message || 'Failed to fetch usage');
  }
});

const usageSlice = createSlice({
  name: 'usage',
  initialState,
  reducers: {
    clearUsageError: state => {
      state.error = null;
    },
    resetUsageState: state => {
      state.used = 0;
      state.remaining = 10;
      state.limit = 10;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchUsageThunk.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUsageThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.used = action.payload?.used ?? state.used;
        state.remaining = action.payload?.remaining ?? state.remaining;
        state.limit = action.payload?.limit ?? state.limit;
      })
      .addCase(fetchUsageThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearUsageError, resetUsageState } = usageSlice.actions;
export default usageSlice.reducer;
