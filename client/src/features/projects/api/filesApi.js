import { apiClient } from '@/shared/api/client';

export const filesApi = {
  uploadFile(projectId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.fetchMultipart(`/projects/${projectId}/files`, formData);
  },

  getProjectFiles(projectId, skip = 0, take = 10) {
    return apiClient.fetch(`/projects/${projectId}/files?skip=${skip}&take=${take}`);
  },

  deleteFile(projectId, fileId) {
    return apiClient.fetch(`/projects/${projectId}/files/${fileId}`, { method: 'DELETE' });
  },
};
