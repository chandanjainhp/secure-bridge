import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { store } from "@/app/store";
import {
  clearApiKeyError,
  deleteApiKeyThunk,
  fetchApiKeyThunk,
  resetApiKeyState,
  saveApiKeyThunk,
} from "../state/apiKeySlice";

const selectApiKey = (state) => state.apiKey;

const createActions = (dispatch) => ({
  fetchApiKey: async () => {
    const result = await dispatch(fetchApiKeyThunk()).unwrap();
    return result;
  },
  saveApiKey: async (provider, key, localConnection) => {
    const result = await dispatch(
      saveApiKeyThunk({ provider, key, localConnection }),
    ).unwrap();
    return result;
  },
  deleteApiKey: async (keyId) => {
    const result = await dispatch(deleteApiKeyThunk(keyId)).unwrap();
    return result;
  },
  clearError: () => dispatch(clearApiKeyError()),
  reset: () => dispatch(resetApiKeyState()),
});

export const useApiKeyStore = (selector) => {
  const dispatch = useDispatch();
  const apiKeyState = useSelector(selectApiKey);
  const actions = useMemo(() => createActions(dispatch), [dispatch]);
  const combined = useMemo(
    () => ({ ...apiKeyState, ...actions }),
    [apiKeyState, actions],
  );
  return selector ? selector(combined) : combined;
};

useApiKeyStore.getState = () => ({
  ...store.getState().apiKey,
  ...createActions(store.dispatch),
});
useApiKeyStore.setState = (partial) => {
  store.dispatch({ type: "apiKey/setState", payload: partial });
};
