import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";

import "./styles.css";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
