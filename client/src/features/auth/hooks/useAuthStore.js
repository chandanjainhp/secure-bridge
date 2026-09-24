import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { store } from '@/app/store';
import {
  clearAuthStorage,
  clearOTPState as clearOTPStateAction,
  clearRegistrationState as clearRegistrationStateAction,
  initializeAuthThunk,
  loginThunk,
  logoutAndClearThunk,
  patchAuthState,
  persistAuthState,
  refreshAccessTokenThunk,
  registerThunk,
  resendOTPThunk,
  resetAuthState,
  resetPasswordThunk,
  sendOTPThunk,
  sendRegistrationOTPThunk,
  setLoginMethod as setLoginMethodAction,
  setUser as setUserAction,
  verifyOTPThunk,
  verifyRegistrationOTPThunk,
} from '@/features/auth/state/authSlice';

const selectAuth = state => state.auth;

const persistFromStore = () => persistAuthState(store.getState().auth);

const createActions = dispatch => ({
  login: async (email, password, rememberMe = false) => {
    const result = await dispatch(loginThunk({ email, password, rememberMe })).unwrap();
    persistFromStore();
    return result;
  },
  register: async (name, email, password) => {
    const result = await dispatch(registerThunk({ name, email, password })).unwrap();
    persistFromStore();
    return result;
  },
  sendOTP: async (email, mode) => dispatch(sendOTPThunk({ email, mode })).unwrap(),
  verifyOTP: async (email, otp, mode, name) => {
    const result = await dispatch(verifyOTPThunk({ email, otp, mode, name })).unwrap();
    persistFromStore();
    return result;
  },
  verifyRegistrationOTP: async (email, otp) => {
    const result = await dispatch(verifyRegistrationOTPThunk({ email, otp })).unwrap();
    persistFromStore();
    return result;
  },
  resendOTP: async (email, mode) => dispatch(resendOTPThunk({ email, mode })).unwrap(),
  resetPassword: async ({ email, otp, newPassword }) => dispatch(resetPasswordThunk({ email, otp, newPassword })).unwrap(),
  sendRegistrationOTP: async (name, email, password) =>
    dispatch(sendRegistrationOTPThunk({ name, email, password })).unwrap(),
  clearOTPState: () => dispatch(clearOTPStateAction()),
  clearRegistrationState: () => dispatch(clearRegistrationStateAction()),
  setUser: user => {
    dispatch(setUserAction(user));
    persistFromStore();
  },
  setLoginMethod: method => dispatch(setLoginMethodAction(method)),
  refreshAccessToken: async () => {
    const result = await dispatch(refreshAccessTokenThunk()).unwrap();
    persistFromStore();
    return result;
  },
  initializeAuth: async () => {
    const result = await dispatch(initializeAuthThunk()).unwrap();
    persistFromStore();
    return result;
  },
  logout: async () => {
    try {
      await dispatch(logoutAndClearThunk());
    } finally {
      clearAuthStorage();
      dispatch(resetAuthState());
      persistFromStore();
    }
  },
});

export const useAuthStore = selector => {
  const dispatch = useDispatch();
  const authState = useSelector(selectAuth);
  const actions = useMemo(() => createActions(dispatch), [dispatch]);
  const combined = useMemo(() => ({ ...authState, ...actions }), [authState, actions]);
  return selector ? selector(combined) : combined;
};

useAuthStore.getState = () => ({ ...store.getState().auth, ...createActions(store.dispatch) });
useAuthStore.setState = partial => {
  store.dispatch(patchAuthState(partial));
  persistFromStore();
};

