import { ConfigProvider } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

import "antd/dist/reset.css";
import "./global.css";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

createRoot(root).render(
  <StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </StrictMode>,
);
