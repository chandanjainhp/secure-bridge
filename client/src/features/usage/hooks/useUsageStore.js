import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { store } from '@/app/store';
import { clearUsageError, fetchUsageThunk, resetUsageState } from '../state/usageSlice';

const selectUsage = state => state.usage;

const createActions = dispatch => ({
  fetchUsage: async () => {
    const result = await dispatch(fetchUsageThunk()).unwrap();
    return result;
  },
  clearError: () => dispatch(clearUsageError()),
  reset: () => dispatch(resetUsageState()),
});

export const useUsageStore = selector => {
  const dispatch = useDispatch();
  const usageState = useSelector(selectUsage);
  const actions = useMemo(() => createActions(dispatch), [dispatch]);
  const combined = useMemo(() => ({ ...usageState, ...actions }), [usageState, actions]);
  return selector ? selector(combined) : combined;
};

useUsageStore.getState = () => ({ ...store.getState().usage, ...createActions(store.dispatch) });
useUsageStore.setState = partial => {
  store.dispatch({ type: 'usage/setState', payload: partial });
};
