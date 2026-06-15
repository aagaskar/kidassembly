import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initStorage } from "./engine/storage";
import "./styles.css";

function VersionFooter() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 4,
        right: 8,
        fontSize: 11,
        opacity: 0.5,
        fontFamily: "monospace",
        pointerEvents: "none",
      }}
    >
      {__GIT_COMMIT__}
    </div>
  );
}

initStorage().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
      <VersionFooter />
    </React.StrictMode>
  );
});
