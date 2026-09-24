import { apiClient } from '@/shared/api/client';
// Auth endpoints are `silent`: failures are displayed inline by the auth
// forms (the central API client would otherwise double-toast them).
const silent = { silent: true };
const captureToken = result => { if (result?.data?.accessToken) apiClient.setToken(result.data.accessToken); return result; };
export const authApi = {
  sendOTP: (email, mode = 'login') => apiClient.fetch('/auth/send-otp', { method: 'POST', ...silent, body: JSON.stringify({ email, mode }) }),
  verifyOTP: async (email, otp, name, mode = 'login', password) => captureToken(await apiClient.fetch('/auth/verify-otp', { method: 'POST', ...silent, body: JSON.stringify({ email, otp, ...(name ? { name } : {}), mode, ...(mode === 'register' && password ? { password } : {}) }) })),
  resendOTP: (email, mode = 'login') => apiClient.fetch('/auth/resend-otp', { method: 'POST', ...silent, body: JSON.stringify({ email, mode }) }),
  register: (name, email, password) => apiClient.fetch('/auth/register', { method: 'POST', ...silent, body: JSON.stringify({ name, email, password }) }),
  login: async (email, password, rememberMe = false) => captureToken(await apiClient.fetch('/auth/login', { method: 'POST', ...silent, body: JSON.stringify({ email, password, rememberMe }) })),
  getProfile: () => apiClient.fetch('/auth/me'),
  logout: async () => { try { return await apiClient.fetch('/auth/logout', { method: 'POST' }); } finally { apiClient.clearToken(); } },
  refresh: async () => captureToken(await apiClient.fetch('/auth/refresh', { method: 'POST' })),
  resetPassword: ({ email, otp, newPassword }) => apiClient.fetch('/auth/reset-password', { method: 'POST', ...silent, body: JSON.stringify({ email, otp, newPassword }) }),
  changePassword: (oldPassword, newPassword) => apiClient.fetch('/auth/change-password', { method: 'PATCH', ...silent, body: JSON.stringify({ oldPassword, newPassword }) }),
  updateAccount: data => apiClient.fetch('/auth/account', { method: 'PATCH', body: JSON.stringify(data) }),
  uploadAvatar: file => { const form = new FormData(); form.append('avatar', file); return apiClient.fetchMultipart('/auth/avatar', form); },
};
