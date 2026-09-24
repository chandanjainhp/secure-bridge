import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiKeyApi } from "../api/apiKeyApi";

const STORAGE_KEY = "apikey-storage";

const readPersistedState = () => {
  if (typeof window === "undefined") {
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
  hasKey: persisted.hasKey || false,
  maskedKey: persisted.maskedKey || null,
  provider: persisted.provider || "openai",
  localConnection: persisted.localConnection || null,
  isLoading: false,
  error: null,
};

export const fetchApiKeyThunk = createAsyncThunk(
  "apiKey/fetchApiKey",
  async (_, { rejectWithValue }) => {
    try {
      return await apiKeyApi.getApiKey();
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch API key");
    }
  },
);

export const saveApiKeyThunk = createAsyncThunk(
  "apiKey/saveApiKey",
  async ({ provider, key, localConnection }, { rejectWithValue }) => {
    try {
      return await apiKeyApi.saveApiKey(provider, key, localConnection);
    } catch (error) {
      return rejectWithValue(error.message || "Failed to save API key");
    }
  },
);

export const deleteApiKeyThunk = createAsyncThunk(
  "apiKey/deleteApiKey",
  async (keyId, { rejectWithValue }) => {
    try {
      return await apiKeyApi.deleteApiKey(keyId);
    } catch (error) {
      return rejectWithValue(error.message || "Failed to delete API key");
    }
  },
);

const apiKeySlice = createSlice({
  name: "apiKey",
  initialState,
  reducers: {
    clearApiKeyError: (state) => {
      state.error = null;
    },
    resetApiKeyState: (state) => {
      state.hasKey = false;
      state.maskedKey = null;
      state.provider = "openai";
      state.localConnection = null;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApiKeyThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchApiKeyThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.hasKey = action.payload?.hasKey || false;
        state.maskedKey = action.payload?.maskedKey || null;
        state.provider = action.payload?.provider || state.provider;
        state.localConnection =
          action.payload?.localConnection || state.localConnection;
      })
      .addCase(fetchApiKeyThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(saveApiKeyThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveApiKeyThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.hasKey = true;
        state.maskedKey = action.payload?.maskedKey || null;
        state.provider = action.meta.arg.provider;
        state.localConnection =
          action.meta.arg.provider === "local"
            ? {
                ...action.meta.arg.localConnection,
                id: action.payload?._id || action.payload?.id,
              }
            : null;
      })
      .addCase(saveApiKeyThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(deleteApiKeyThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteApiKeyThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.hasKey = false;
        state.maskedKey = null;
        state.localConnection = null;
      })
      .addCase(deleteApiKeyThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearApiKeyError, resetApiKeyState } = apiKeySlice.actions;
export default apiKeySlice.reducer;
