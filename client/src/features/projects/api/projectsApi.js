import { apiClient } from '@/shared/api/client';
import { isValidProject, isValidProjectArray } from '../state/projectValidators';
const unwrap = result => result?.data ?? result;
const validateProject = project => { if (!isValidProject(project)) throw new Error('Server returned invalid project data'); return project; };
export const projectsApi = {
  async getProjects() { const result = unwrap(await apiClient.fetch('/projects')); if (!isValidProjectArray(result?.projects || [])) throw new Error('Server returned invalid project data'); return result; },
  async createProject(data) { return validateProject(unwrap(await apiClient.fetch('/projects', { method: 'POST', body: JSON.stringify(data) }))); },
  async getProject(id) { return validateProject(unwrap(await apiClient.fetch(`/projects/${id}`))); },
  async updateProject(id, data) { return validateProject(unwrap(await apiClient.fetch(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }))); },
  async deleteProject(id) { return apiClient.fetch(`/projects/${id}`, { method: 'DELETE' }); },
  async getConversations(projectId) { return apiClient.fetch(`/projects/${projectId}/conversations`); },
  async createConversation(projectId, title = 'New Conversation') { return apiClient.fetch(`/projects/${projectId}/conversations`, { method: 'POST', body: JSON.stringify({ title }) }); },
  async getConversation(projectId, conversationId) { return apiClient.fetch(`/projects/${projectId}/conversations/${conversationId}`); },
  async updateConversation(projectId, conversationId, title) { return apiClient.fetch(`/projects/${projectId}/conversations/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ title }) }); },
  async deleteConversation(projectId, conversationId) { return apiClient.fetch(`/projects/${projectId}/conversations/${conversationId}`, { method: 'DELETE' }); },
  async getConversationMessages(projectId, conversationId) { return apiClient.fetch(`/projects/${projectId}/conversations/${conversationId}/messages`); },
  async sendMessage(projectId, conversationId, content, role = 'user') { return apiClient.fetch(`/projects/${projectId}/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content, role }) }); },
};
