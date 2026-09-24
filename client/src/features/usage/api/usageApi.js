import { apiClient } from '@/shared/api/client';
export const usageApi = { async getUsage() { const result = await apiClient.fetch('/usage'); return result?.data ?? result; } };
