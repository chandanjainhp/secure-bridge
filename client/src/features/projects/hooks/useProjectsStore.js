import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { store } from '@/app/store';
import {
  addMessage as addMessageAction,
  createConversationThunk,
  createProjectThunk,
  deleteConversationThunk,
  deleteProjectThunk,
  fetchConversationMessagesThunk,
  fetchConversationsThunk,
  fetchProjectThunk,
  fetchProjectsThunk,
  patchProjectsState,
  persistProjectsState,
  setCurrentConversation as setCurrentConversationAction,
  setCurrentProject as setCurrentProjectAction,
  updateConversationThunk,
  updateProjectThunk,
  sendMessageThunk,
} from '@/features/projects/state/projectsSlice';

const selectProjects = state => state.projects;

const persistFromStore = () => persistProjectsState(store.getState().projects);

const createActions = dispatch => ({
  createProject: async projectData => {
    const result = await dispatch(createProjectThunk({ projectData })).unwrap();
    persistFromStore();
    return result;
  },
  fetchProjects: async () => {
    const result = await dispatch(fetchProjectsThunk()).unwrap();
    persistFromStore();
    return result;
  },
  fetchProject: async id => {
    const result = await dispatch(fetchProjectThunk({ id })).unwrap();
    persistFromStore();
    return result;
  },
  updateProject: async (id, updates) => {
    const result = await dispatch(updateProjectThunk({ id, updates })).unwrap();
    persistFromStore();
    return result;
  },
  deleteProject: async id => {
    const result = await dispatch(deleteProjectThunk({ id })).unwrap();
    persistFromStore();
    return result;
  },
  setCurrentProject: project => {
    dispatch(setCurrentProjectAction(project));
    persistFromStore();
  },
  fetchConversations: async projectId => {
    const result = await dispatch(fetchConversationsThunk({ projectId })).unwrap();
    persistFromStore();
    return result;
  },
  fetchConversationMessages: async (projectId, conversationId) => {
    const result = await dispatch(fetchConversationMessagesThunk({ projectId, conversationId })).unwrap();
    persistFromStore();
    return result;
  },
  createConversation: async (projectId, initialTitle) => {
    const result = await dispatch(createConversationThunk({ projectId, initialTitle })).unwrap();
    persistFromStore();
    return result;
  },
  setCurrentConversation: conversation => {
    dispatch(setCurrentConversationAction(conversation));
    persistFromStore();
  },
  sendMessage: async (projectId, conversationId, content) => {
    const result = await dispatch(sendMessageThunk({ projectId, conversationId, content })).unwrap();
    persistFromStore();
    return result;
  },
  addMessage: (conversationId, messageData) => {
    dispatch(addMessageAction({ conversationId, messageData }));
    persistFromStore();
  },
  updateConversation: async (projectId, conversationId, title) => {
    const result = await dispatch(updateConversationThunk({ projectId, conversationId, title })).unwrap();
    persistFromStore();
    return result;
  },
  deleteConversation: async (projectId, conversationId) => {
    const result = await dispatch(deleteConversationThunk({ projectId, conversationId })).unwrap();
    persistFromStore();
    return result;
  },
});

export const useProjectsStore = selector => {
  const dispatch = useDispatch();
  const projectsState = useSelector(selectProjects);
  const actions = useMemo(() => createActions(dispatch), [dispatch]);
  const combined = useMemo(() => ({ ...projectsState, ...actions }), [projectsState, actions]);
  return selector ? selector(combined) : combined;
};

useProjectsStore.getState = () => ({ ...store.getState().projects, ...createActions(store.dispatch) });
useProjectsStore.setState = partial => {
  store.dispatch(patchProjectsState(partial));
  persistFromStore();
};

