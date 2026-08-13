import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("jarvis-root");
if (!(container instanceof HTMLElement)) {
  throw new Error("JARVIS desktop root element is missing");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
