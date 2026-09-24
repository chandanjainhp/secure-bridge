import { authApi } from '@/features/auth/api/authApi';
export const usersApi = { updateUserProfile: data => authApi.updateAccount(data), updatePassword: (currentPassword, newPassword) => authApi.changePassword(currentPassword, newPassword), resetPassword: data => authApi.resetPassword(data), uploadAvatar: file => authApi.uploadAvatar(file) };
