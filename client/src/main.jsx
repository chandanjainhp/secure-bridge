import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App.jsx";
import "./index.css";
import { store } from "@/app/store";
import { initializeThemeClass } from "@/app/uiSlice";
import { initApp } from "@/app/init";

initializeThemeClass(store.getState().ui.theme);

// Initialize app-level cross-cutting concerns
initApp();

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(() => false);
}

window.addEventListener("error", event => {
  console.error("❌ [Global Error]", event.error);
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("❌ Root element not found. Check index.html");
}

createRoot(rootElement).render(
  <Provider store={store}>
    <App />
  </Provider>
);
