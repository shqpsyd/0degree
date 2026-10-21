import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@zaitu/design-system/theme.css";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
