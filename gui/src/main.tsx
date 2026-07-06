import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import App from "./App";
import "./index.css";
import { persistor, store } from "./redux/store";

// Deliberately dependency-free (no theme context, no redux, no router) -
// this is the catch-all for anything that escapes every other boundary,
// including a crash in the providers below it, so it can't assume any of
// them are actually working.
function TopLevelErrorFallback({ error }: FallbackProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        height: "100vh",
        padding: "1.5rem",
        textAlign: "center",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1rem", fontWeight: 600 }}>
        Mango hit an unexpected error
      </h1>
      <code
        style={{
          maxWidth: "100%",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "0.75rem",
          opacity: 0.7,
        }}
      >
        {error instanceof Error ? error.message : String(error)}
      </code>
      <button
        onClick={() => window.location.reload()}
        style={{
          cursor: "pointer",
          border: "1px solid currentColor",
          background: "transparent",
          color: "inherit",
          borderRadius: "4px",
          padding: "0.375rem 0.75rem",
          fontSize: "0.875rem",
        }}
      >
        Reload
      </button>
    </div>
  );
}

(async () => {
  const container = document.getElementById("root") as HTMLElement;

  // Create React root
  const root = ReactDOM.createRoot(container);

  root.render(
    <React.StrictMode>
      <ErrorBoundary FallbackComponent={TopLevelErrorFallback}>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <App />
          </PersistGate>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
})();
