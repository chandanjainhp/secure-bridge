import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '@/features/auth/api/authApi';
import { resetProjectsData } from '@/app/utils/appStateReset';

const STORAGE_KEY = 'auth-storage';

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
  user: persisted.user || null,
  isAuthenticated: false,
  isLoading: false,
  accessToken: null,
  loginMethod: null,
  otpMode: null,
  otpEmail: null,
  otpName: null,
  otpSent: false,
  registerName: persisted.registerName || null,
  registerEmail: persisted.registerEmail || null,
  registerOtpSent: !!persisted.registerOtpSent,
  _isHydrated: true,
};

const clearAuthRuntimeState = {
  user: null,
  isAuthenticated: false,
  accessToken: null,
  loginMethod: null,
  otpMode: null,
  otpEmail: null,
  otpName: null,
  otpSent: false,
  registerName: null,
  registerEmail: null,
  registerOtpSent: false,
};

const normalizeUser = (userData, fallback = {}) => ({
  id: userData?.id || userData?._id || '',
  email: userData?.email || fallback.email || '',
  name: userData?.fullName || fallback.name || '',
  avatarUrl: userData?.avatarUrl,
  createdAt: userData?.createdAt,
  chatLimit: userData?.chatLimit,
  chatUsageCount: userData?.chatUsageCount,
});

export const loginThunk = createAsyncThunk('auth/login', async ({ email, password, rememberMe = false }, { rejectWithValue }) => {
  try {
    const response = await authApi.login(email, password, rememberMe);
    if (!response.success || !response.data?.user) {
      throw new Error(response.message || 'Login failed');
    }
    return response.data;
  } catch (error) {
    return rejectWithValue(error.message || 'Login failed');
  }
});

export const registerThunk = createAsyncThunk('auth/register', async ({ name, email, password }, { rejectWithValue }) => {
  try {
    const response = await authApi.register(name, email, password);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Registration failed');
    }
    return { user: response.data, fallbackName: name, pendingVerification: true };
  } catch (error) {
    return rejectWithValue(error.message || 'Registration failed');
  }
});

export const sendOTPThunk = createAsyncThunk('auth/sendOTP', async ({ email, mode }, { rejectWithValue }) => {
  try {
    await authApi.sendOTP(email, mode);
    return { email, mode };
  } catch (error) {
    return rejectWithValue(error.message || 'Failed to send OTP');
  }
});

export const verifyOTPThunk = createAsyncThunk(
  'auth/verifyOTP',
  async ({ email, otp, mode, name }, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyOTP(email, otp, name, mode);
      if (mode === 'reset_password') {
        if (!response.success) {
          throw new Error(response.message || 'OTP verification failed');
        }
        return { email, mode, verified: true };
      }
      if (!response.success || !response.data?.user) {
        throw new Error(response.message || 'OTP verification failed');
      }
      return { ...response.data, email, mode, name };
    } catch (error) {
      return rejectWithValue(error.message || 'OTP verification failed');
    }
  },
);

export const verifyRegistrationOTPThunk = createAsyncThunk(
  'auth/verifyRegistrationOTP',
  async ({ email, otp }, { getState, rejectWithValue }) => {
    try {
      const state = getState().auth;
      if (!state.registerName || !state.registerEmail) {
        throw new Error('Registration data missing. Please start registration again.');
      }
      const response = await authApi.verifyOTP(email, otp, undefined, 'register');
      if (!response.success || !response.data?.user) {
        throw new Error(response.message || 'Registration OTP verification failed');
      }
      return { ...response.data, email, name: state.registerName };
    } catch (error) {
      return rejectWithValue(error.message || 'Registration OTP verification failed');
    }
  },
);

export const resendOTPThunk = createAsyncThunk('auth/resendOTP', async ({ email, mode }, { rejectWithValue }) => {
  try {
    await authApi.resendOTP(email, mode);
    return { email, mode };
  } catch (error) {
    return rejectWithValue(error.message || 'Failed to resend OTP');
  }
});

export const resetPasswordThunk = createAsyncThunk('auth/resetPassword', async ({ email, otp, newPassword }, { rejectWithValue }) => {
  try {
    await authApi.resetPassword({ email, otp, newPassword });
    return true;
  } catch (error) {
    return rejectWithValue(error.message || 'Failed to reset password');
  }
});

export const sendRegistrationOTPThunk = createAsyncThunk(
  'auth/sendRegistrationOTP',
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      await authApi.register(name, email, password);
      return { name, email };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to send registration OTP');
    }
  },
);

export const refreshAccessTokenThunk = createAsyncThunk('auth/refreshAccessToken', async (_, { rejectWithValue }) => {
  try {
    const response = await authApi.refresh();
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Refresh failed');
    }
    return response.data;
  } catch (error) {
    return rejectWithValue(error.message || 'Refresh failed');
  }
});

export const initializeAuthThunk = createAsyncThunk('auth/initializeAuth', async (_, { rejectWithValue }) => {
  try {
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) return { user: response.data };
    } catch (error) {
      if (error?.status !== 401) throw error;
    }

    // Access tokens are intentionally memory-only. On a hard refresh, recover the
    // session from the httpOnly refresh cookie, then fetch the current profile.
    const refreshed = await authApi.refresh();
    if (!refreshed.success || !refreshed.data?.accessToken) {
      throw new Error(refreshed.message || 'Session refresh failed');
    }
    const profile = await authApi.getProfile();
    if (!profile.success || !profile.data) {
      throw new Error(profile.message || 'Invalid profile response');
    }
    return { user: profile.data, accessToken: refreshed.data.accessToken };
  } catch (error) {
    return rejectWithValue(error.message || 'Auth initialization failed');
  }
});

export const logoutThunk = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await authApi.logout();
    return true;
  } catch (error) {
    return rejectWithValue(error.message || 'Logout failed');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    patchAuthState(state, action) {
      Object.assign(state, action.payload);
    },
    setUser(state, action) {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setLoginMethod(state, action) {
      state.loginMethod = action.payload;
    },
    clearOTPState(state) {
      state.loginMethod = null;
      state.otpMode = null;
      state.otpSent = false;
      state.otpEmail = null;
      state.otpName = null;
    },
    clearRegistrationState(state) {
      state.registerName = null;
      state.registerEmail = null;
      state.registerOtpSent = false;
    },
    resetAuthState(state) {
      Object.assign(state, clearAuthRuntimeState, { isLoading: false });
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loginThunk.pending, state => {
        state.isLoading = true;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = normalizeUser(action.payload.user);
        state.isAuthenticated = true;
        state.accessToken = action.payload.accessToken || null;
        state.loginMethod = 'password';
        state.otpMode = null;
        state.otpSent = false;
        state.otpEmail = null;
        state.otpName = null;
      })
      .addCase(loginThunk.rejected, state => {
        state.isLoading = false;
        Object.assign(state, clearAuthRuntimeState);
      })
      .addCase(registerThunk.pending, state => {
        state.isLoading = true;
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = normalizeUser(action.payload.user, { name: action.payload.fallbackName });
        state.isAuthenticated = false;
      })
      .addCase(registerThunk.rejected, state => {
        state.isLoading = false;
      })
      .addCase(sendOTPThunk.pending, state => {
        state.isLoading = true;
      })
      .addCase(sendOTPThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loginMethod = action.payload.mode === 'login' ? 'otp' : null;
        state.otpMode = action.payload.mode;
        state.otpSent = true;
        state.otpEmail = action.payload.email;
      })
      .addCase(sendOTPThunk.rejected, state => {
        state.isLoading = false;
      })
      .addCase(verifyOTPThunk.pending, state => {
        state.isLoading = true;
      })
      .addCase(verifyOTPThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.mode === 'reset_password') {
          state.otpMode = null;
          state.otpSent = false;
          state.otpEmail = null;
          state.otpName = null;
          return;
        }
        state.user = normalizeUser(action.payload.user, {
          email: action.payload.email,
          name: action.payload.name,
        });
        state.isAuthenticated = true;
        state.accessToken = action.payload.accessToken || null;
        state.loginMethod = null;
        state.otpMode = null;
        state.otpSent = false;
        state.otpEmail = null;
        state.otpName = null;
        state.registerName = null;
        state.registerEmail = null;
        state.registerOtpSent = false;
      })
      .addCase(verifyOTPThunk.rejected, state => {
        state.isLoading = false;
      })
      .addCase(verifyRegistrationOTPThunk.pending, state => {
        state.isLoading = true;
      })
      .addCase(verifyRegistrationOTPThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = normalizeUser(action.payload.user, {
          email: action.payload.email,
          name: action.payload.name,
        });
        state.isAuthenticated = true;
        state.accessToken = action.payload.accessToken || null;
        state.registerName = null;
        state.registerEmail = null;
        state.registerOtpSent = false;
      })
      .addCase(verifyRegistrationOTPThunk.rejected, state => {
        state.isLoading = false;
      })
      .addCase(resendOTPThunk.pending, state => {
        state.isLoading = true;
      })
      .addCase(resendOTPThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.otpEmail = action.payload.email;
      })
      .addCase(resendOTPThunk.rejected, state => {
        state.isLoading = false;
      })
      .addCase(resetPasswordThunk.pending, state => {
        state.isLoading = true;
      })
      .addCase(resetPasswordThunk.fulfilled, state => {
        state.isLoading = false;
      })
      .addCase(resetPasswordThunk.rejected, state => {
        state.isLoading = false;
      })
      .addCase(sendRegistrationOTPThunk.pending, state => {
        state.isLoading = true;
      })
.addCase(sendRegistrationOTPThunk.fulfilled, (state, action) => {
         state.isLoading = false;
         state.registerName = action.payload.name;
         state.registerEmail = action.payload.email;
         state.registerOtpSent = true;
         state.otpMode = 'register';
         state.otpEmail = action.payload.email;
         state.otpName = action.payload.name;
         state.otpSent = true;
       })
      .addCase(sendRegistrationOTPThunk.rejected, state => {
        state.isLoading = false;
      })
      .addCase(refreshAccessTokenThunk.fulfilled, (state, action) => {
        if (!action.payload) {
          return;
        }
        state.user = action.payload.user || state.user;
        state.accessToken = action.payload.accessToken || null;
        state.isAuthenticated = true;
      })
      .addCase(refreshAccessTokenThunk.rejected, state => {
        state.user = null;
        state.isAuthenticated = false;
        state.accessToken = null;
      })
      .addCase(initializeAuthThunk.pending, state => {
        state.isLoading = true;
      })
      .addCase(initializeAuthThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        if (!action.payload) {
          state.user = null;
          state.isAuthenticated = false;
          return;
        }
        state.user = normalizeUser(action.payload.user);
        state.isAuthenticated = true;
        state.accessToken = action.payload.accessToken || state.accessToken || null;
      })
      .addCase(initializeAuthThunk.rejected, state => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(logoutThunk.pending, state => {
        state.isLoading = true;
      })
      .addCase(logoutThunk.fulfilled, state => {
        Object.assign(state, clearAuthRuntimeState);
        state.isLoading = false;
      })
      .addCase(logoutThunk.rejected, state => {
        Object.assign(state, clearAuthRuntimeState);
        state.isLoading = false;
      });
  },
});

export const persistAuthState = state => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      state: {
        user: state.user,
        registerName: state.registerName,
        registerEmail: state.registerEmail,
        registerOtpSent: state.registerOtpSent,
      },
    }),
  );
};

export const clearAuthStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
};

export const logoutAndClearThunk = () => async dispatch => {
  try {
    await dispatch(logoutThunk()).unwrap();
  } finally {
    clearAuthStorage();
    resetProjectsData('user_logout');
  }
};

export const { patchAuthState, setUser, setLoginMethod, clearOTPState, clearRegistrationState, resetAuthState } =
  authSlice.actions;
export const authReducer = authSlice.reducer;

