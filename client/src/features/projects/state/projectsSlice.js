import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { projectsApi } from "@/features/projects/api/projectsApi";
import { store } from "@/app/store";
import { setUser } from "@/features/auth/state/authSlice";
import { chatApi } from "@/features/chat/api/chatApi";

const STORAGE_KEY = "projects-storage";

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
  projects: Array.isArray(persisted.projects) ? persisted.projects : [],
  currentProject: persisted.currentProject || null,
  conversations: Array.isArray(persisted.conversations)
    ? persisted.conversations
    : [],
  currentConversation: persisted.currentConversation || null,
  isLoading: false,
};

const sortByUpdatedAt = (list) =>
  list.sort(
    (a, b) =>
      new Date(b.updatedAt || 0).getTime() -
      new Date(a.updatedAt || 0).getTime(),
  );

export const fetchProjectsThunk = createAsyncThunk(
  "projects/fetchProjects",
  async (_, { rejectWithValue }) => {
    try {
      const response = await projectsApi.getProjects();
      return response.projects || [];
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch projects");
    }
  },
);

export const fetchProjectThunk = createAsyncThunk(
  "projects/fetchProject",
  async ({ id }, { rejectWithValue }) => {
    try {
      return await projectsApi.getProject(id);
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch project");
    }
  },
);

export const createProjectThunk = createAsyncThunk(
  "projects/createProject",
  async ({ projectData }, { rejectWithValue }) => {
    try {
      return await projectsApi.createProject(projectData);
    } catch (error) {
      return rejectWithValue(error.message || "Failed to create project");
    }
  },
);

export const updateProjectThunk = createAsyncThunk(
  "projects/updateProject",
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      return await projectsApi.updateProject(id, updates);
    } catch (error) {
      return rejectWithValue(error.message || "Failed to update project");
    }
  },
);

export const deleteProjectThunk = createAsyncThunk(
  "projects/deleteProject",
  async ({ id }, { rejectWithValue }) => {
    try {
      await projectsApi.deleteProject(id);
      return { id };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to delete project");
    }
  },
);

export const fetchConversationsThunk = createAsyncThunk(
  "projects/fetchConversations",
  async ({ projectId }, { rejectWithValue }) => {
    try {
      const response = await projectsApi.getConversations(projectId);
      const data = response.data || response;
      const items = Array.isArray(data) ? data : data?.conversations || [];
      const unique = new Map();
      items
        .filter((conv) => conv.id && conv.projectId === projectId)
        .forEach((conv) => {
          const existing = unique.get(conv.id);
          if (
            !existing ||
            new Date(conv.updatedAt) > new Date(existing.updatedAt)
          ) {
            unique.set(conv.id, {
              ...conv,
              messages: Array.isArray(conv.messages) ? conv.messages : [],
            });
          }
        });
      return {
        projectId,
        conversations: sortByUpdatedAt(Array.from(unique.values())),
      };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch conversations");
    }
  },
);

export const fetchConversationMessagesThunk = createAsyncThunk(
  "projects/fetchConversationMessages",
  async ({ projectId, conversationId }, { rejectWithValue }) => {
    try {
      const response = await projectsApi.getConversationMessages(
        projectId,
        conversationId,
      );
      const data = response.data || response;
      const messages = Array.isArray(data?.messages) ? data.messages : [];
      messages.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime(),
      );
      return { conversationId, messages };
    } catch (error) {
      return rejectWithValue(
        error.message || "Failed to fetch conversation messages",
      );
    }
  },
);

export const createConversationThunk = createAsyncThunk(
  "projects/createConversation",
  async (
    { projectId, initialTitle = "New Conversation" },
    { rejectWithValue },
  ) => {
    try {
      const response = await projectsApi.createConversation(
        projectId,
        initialTitle,
      );
      const raw = response.data || response;
      if (!raw.id || /^\d{13,}$/.test(raw.id)) {
        throw new Error("Backend returned invalid conversation ID");
      }
      return {
        id: raw.id,
        projectId: raw.projectId || projectId,
        title: raw.title || "New Conversation",
        messages: Array.isArray(raw.messages) ? raw.messages : [],
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to create conversation");
    }
  },
);

export const sendMessageThunk = createAsyncThunk(
  "projects/sendMessage",
  async (
    { projectId, conversationId, content },
    { rejectWithValue, getState, dispatch },
  ) => {
    try {
      const state = getState();
      const project =
        state.projects.projects.find((p) => p.id === projectId) ||
        state.projects.currentProject;
      if (!project) throw new Error("Project not found");
      
      // Exclude optimistic/placeholder bubbles (added by the pending reducer
      // before this thunk body runs) — the empty typing placeholder must
      // never be sent to the backend as history.
      const history = (
        state.projects.conversations.find((c) => c.id === conversationId)
          ?.messages || []
      ).filter((m) => !m.isOptimistic && !m.isLoading);
      
      // Persist user message to backend
      const userResult = await projectsApi.sendMessage(
        projectId,
        conversationId,
        content,
        "user",
      );
      const userMessage = userResult.data || userResult;
      
      // Call chat API to get assistant response
      const chatResult = await chatApi.complete({
        model: project.model,
        messages: [
          {
            role: "system",
            content: project.systemPrompt || "You are a helpful AI assistant.",
          },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content },
        ],
        temperature: project.temperature,
        max_tokens: project.maxTokens,
      });
      
      // Extract assistant content from chat API response
      // Handle both streaming and non-streaming response formats
      let assistantContent = '';
      
      if (chatResult?.data) {
        // Non-streaming response format
        assistantContent = chatResult.data?.choices?.[0]?.message?.content?.trim() ||
          chatResult.data?.output?.text?.trim() ||
          chatResult.data?.text?.trim() ||
          '';
      } else if (chatResult?.choices?.[0]?.message?.content) {
        // Direct response format (if apiClient returns data directly)
        assistantContent = chatResult.choices[0].message.content.trim();
      } else if (chatResult?.output?.text) {
        // Alternative response format
        assistantContent = chatResult.output.text.trim();
      } else if (chatResult?.text) {
        // Simple text response
        assistantContent = chatResult.text.trim();
      }
      
      if (!assistantContent) {
        throw new Error("The local model returned an empty response");
      }

      // Create assistant message object
      const assistantMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: assistantContent,
        createdAt: new Date().toISOString(),
      };

      // Try to persist assistant message to backend
      try {
        const assistantResult = await projectsApi.sendMessage(
          projectId,
          conversationId,
          assistantContent,
          "assistant",
        );
        // Merge backend's response (which includes the persisted message with backend-generated ID)
        if (assistantResult?.data) {
          Object.assign(assistantMessage, assistantResult.data);
        } else if (assistantResult) {
          Object.assign(assistantMessage, assistantResult);
        }
      } catch (persistenceError) {
        console.error(
          "Assistant response generated but could not be persisted",
          {
            status: persistenceError?.status,
            endpoint: persistenceError?.endpoint,
          },
        );
        // Continue even if persistence fails - we still want to show the message in UI
      }
      
      // Update chat usage count
      if (state.auth.user) {
        dispatch(
          setUser({
            ...state.auth.user,
            chatUsageCount: (state.auth.user.chatUsageCount || 0) + 1,
          }),
        );
      }
      
      // Return both messages so the reducer can add them to the store
      return { conversationId, userMessage, assistantMessage };
    } catch (error) {
      // Keep the user's message visible with an inline error bubble instead of
      // silently dropping the whole exchange.
      const state = getState();
      const project =
        state.projects.projects.find((p) => p.id === projectId) ||
        state.projects.currentProject;
      const assistantMessage = {
        id: `${Date.now()}-assistant-error`,
        role: "assistant",
        content:
          error?.message ||
          "The model could not be reached. Check that your configured model (local server or API key) is available and try again.",
        createdAt: new Date().toISOString(),
        isError: true,
      };
      return {
        conversationId,
        userMessage: {
          id: `${Date.now()}-user`,
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        },
        assistantMessage,
        _model: project?.model,
        _error: true,
      };
    }
  },
);

export const updateConversationThunk = createAsyncThunk(
  "projects/updateConversation",
  async ({ projectId, conversationId, title }, { rejectWithValue }) => {
    try {
      const response = await projectsApi.updateConversation(
        projectId,
        conversationId,
        title,
      );
      const conversation = response.data || response;
      return { conversationId, title: conversation.title || title };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to update conversation");
    }
  },
);

export const deleteConversationThunk = createAsyncThunk(
  "projects/deleteConversation",
  async ({ projectId, conversationId }, { rejectWithValue }) => {
    try {
      await projectsApi.deleteConversation(projectId, conversationId);
      return { conversationId };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to delete conversation");
    }
  },
);

const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    patchProjectsState(state, action) {
      Object.assign(state, action.payload);
    },
    setCurrentProject(state, action) {
      state.currentProject = action.payload;
    },
    setCurrentConversation(state, action) {
      const conversation = action.payload;
      if (!conversation) {
        state.currentConversation = null;
        return;
      }
      if (!conversation.id || /^\d{13,}$/.test(conversation.id)) {
        return;
      }
      state.currentConversation = conversation;
    },
    addMessage(state, action) {
      const { conversationId, messageData } = action.payload;
      const newMessage = {
        ...messageData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      state.conversations = state.conversations.map((conv) => {
        if (conv.id !== conversationId) return conv;
        const messages = [...(conv.messages || []), newMessage];
        const title =
          conv.messages?.length === 0 && messageData.role === "user"
            ? `${messageData.content.slice(0, 50)}${messageData.content.length > 50 ? "..." : ""}`
            : conv.title;
        return {
          ...conv,
          messages,
          title,
          updatedAt: new Date().toISOString(),
        };
      });
      if (state.currentConversation?.id === conversationId) {
        const messages = [
          ...(state.currentConversation.messages || []),
          newMessage,
        ];
        const title =
          state.currentConversation.messages?.length === 0 &&
          messageData.role === "user"
            ? `${messageData.content.slice(0, 50)}${messageData.content.length > 50 ? "..." : ""}`
            : state.currentConversation.title;
        state.currentConversation = {
          ...state.currentConversation,
          messages,
          title,
          updatedAt: new Date().toISOString(),
        };
      }
    },
    resetProjectsState(state) {
      state.projects = [];
      state.currentProject = null;
      state.conversations = [];
      state.currentConversation = null;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectsThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchProjectsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjectsThunk.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(fetchProjectThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchProjectThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentProject = action.payload;
      })
      .addCase(fetchProjectThunk.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(createProjectThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createProjectThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const project = {
          ...action.payload,
          conversationCount:
            typeof action.payload.conversationCount === "number"
              ? action.payload.conversationCount
              : 0,
        };
        state.projects = [project, ...state.projects];
      })
      .addCase(createProjectThunk.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(updateProjectThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateProjectThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const updated = action.payload;
        state.projects = state.projects.map((project) =>
          project.id === updated.id ? updated : project,
        );
        if (state.currentProject?.id === updated.id) {
          state.currentProject = updated;
        }
      })
      .addCase(updateProjectThunk.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(deleteProjectThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteProjectThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.projects = state.projects.filter(
          (project) => project.id !== action.payload.id,
        );
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = null;
        }
        state.conversations = state.conversations.filter(
          (conv) => conv.projectId !== action.payload.id,
        );
      })
      .addCase(deleteProjectThunk.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(fetchConversationsThunk.fulfilled, (state, action) => {
        state.conversations = action.payload.conversations;
      })
      .addCase(fetchConversationsThunk.rejected, (state) => {
        state.conversations = [];
      })
      .addCase(fetchConversationMessagesThunk.fulfilled, (state, action) => {
        state.conversations = state.conversations.map((conv) =>
          conv.id === action.payload.conversationId
            ? { ...conv, messages: action.payload.messages }
            : conv,
        );
        if (state.currentConversation?.id === action.payload.conversationId) {
          state.currentConversation = {
            ...state.currentConversation,
            messages: action.payload.messages,
          };
        }
      })
      .addCase(createConversationThunk.fulfilled, (state, action) => {
        const exists = state.conversations.some(
          (conv) => conv.id === action.payload.id,
        );
        if (!exists) {
          state.conversations = [action.payload, ...state.conversations];
        }
        state.currentConversation = action.payload;
      })
      .addCase(sendMessageThunk.pending, (state, action) => {
        // Optimistic UI: show the user's message and an AI "typing" bubble
        // immediately — the network round-trip (persist + LLM call) can take
        // seconds, and a blank screen during that window looks broken.
        const { conversationId, content } = action.meta.arg;
        const now = new Date().toISOString();
        const optimisticUser = {
          id: `optimistic-${now}-user`,
          role: "user",
          content,
          createdAt: now,
          isOptimistic: true,
        };
        const typingPlaceholder = {
          id: `optimistic-${now}-assistant`,
          role: "assistant",
          content: "",
          createdAt: now,
          isLoading: true,
        };
        state.conversations = state.conversations.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                messages: [
                  ...(conv.messages || []),
                  optimisticUser,
                  typingPlaceholder,
                ],
                updatedAt: now,
              }
            : conv,
        );
        if (state.currentConversation?.id === conversationId) {
          state.currentConversation = {
            ...state.currentConversation,
            messages: [
              ...(state.currentConversation.messages || []),
              optimisticUser,
              typingPlaceholder,
            ],
            updatedAt: now,
          };
        }
      })
      .addCase(sendMessageThunk.rejected, (state, action) => {
        // Replace the typing placeholder with an inline error bubble so the
        // UI never hangs on a pulsing indicator forever.
        const { conversationId } = action.meta.arg;
        const dropPlaceholders = (messages) =>
          (messages || []).filter((m) => !m.isOptimistic && !m.isLoading);
        const errorBubble = {
          id: `error-${Date.now()}`, 
          role: "assistant",
          content:
            action.payload ||
            action.error?.message ||
            "Message failed to send. Please try again.",
          createdAt: new Date().toISOString(),
          isError: true,
        };
        state.conversations = state.conversations.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                messages: [...dropPlaceholders(conv.messages), errorBubble],
              }
            : conv,
        );
        if (state.currentConversation?.id === conversationId) {
          state.currentConversation = {
            ...state.currentConversation,
            messages: [
              ...dropPlaceholders(state.currentConversation.messages),
              errorBubble,
            ],
          };
        }
      })
      .addCase(sendMessageThunk.fulfilled, (state, action) => {
        const { conversationId, userMessage, assistantMessage } =
          action.payload;
        // Swap the optimistic user message + typing placeholder for the real
        // persisted exchange.
        const dropPlaceholders = (messages) =>
          (messages || []).filter((m) => !m.isOptimistic && !m.isLoading);
        state.conversations = state.conversations.map((conv) => {
          if (conv.id !== conversationId) return conv;
          return {
            ...conv,
            messages: [
              ...dropPlaceholders(conv.messages),
              userMessage,
              assistantMessage,
            ],
            updatedAt: new Date().toISOString(),
          };
        });
        if (state.currentConversation?.id === conversationId) {
          state.currentConversation = {
            ...state.currentConversation,
            messages: [
              ...dropPlaceholders(state.currentConversation.messages),
              userMessage,
              assistantMessage,
            ],
            updatedAt: new Date().toISOString(),
          };
        }
      })
      .addCase(updateConversationThunk.fulfilled, (state, action) => {
        state.conversations = state.conversations.map((conv) =>
          conv.id === action.payload.conversationId
            ? {
                ...conv,
                title: action.payload.title,
                updatedAt: new Date().toISOString(),
              }
            : conv,
        );
        if (state.currentConversation?.id === action.payload.conversationId) {
          state.currentConversation = {
            ...state.currentConversation,
            title: action.payload.title,
            updatedAt: new Date().toISOString(),
          };
        }
      })
      .addCase(deleteConversationThunk.fulfilled, (state, action) => {
        state.conversations = state.conversations.filter(
          (conv) => conv.id !== action.payload.conversationId,
        );
        if (state.currentConversation?.id === action.payload.conversationId) {
          state.currentConversation = null;
        }
      });
  },
});

export const persistProjectsState = (state) => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      state: {
        projects: state.projects,
        currentProject: state.currentProject,
        conversations: state.conversations,
        currentConversation: state.currentConversation,
      },
    }),
  );
};

export const {
  patchProjectsState,
  setCurrentProject,
  setCurrentConversation,
  addMessage,
  resetProjectsState,
} = projectsSlice.actions;
export const projectsReducer = projectsSlice.reducer;

export const selectProjectsState = () => store.getState().projects;
