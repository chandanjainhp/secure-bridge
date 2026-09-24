import { apiClient } from '@/shared/api/client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const aiApi = {
  async testAI() {
    const response = await fetch(`${API_URL}/ai/test`, {
      method: 'GET',
      headers: await apiClient.getHeaders(),
      credentials: 'include',
    });
    return apiClient.handleResponse(response);
  },

  async sendAIMessage(message, conversationHistory, systemPrompt) {
    const response = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: await apiClient.getHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        message,
        conversationHistory: conversationHistory || [],
        systemPrompt: systemPrompt || ''
      })
    });
    return apiClient.handleResponse(response);
  },

  async streamAIMessage(message, onChunk, conversationHistory, systemPrompt) {
    const response = await apiClient.fetchStream('/ai/stream', {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversationHistory: conversationHistory || [],
        systemPrompt: systemPrompt || ''
      })
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.chunk && !data.done) {
              onChunk(data.chunk);
            }
          } catch (e) {
            console.error('Failed to parse stream chunk:', e);
          }
        }
      }
    }
  },
};
