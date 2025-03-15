import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { MatchProvider } from "@/context/MatchContext.tsx";
import "./styles/tailwind.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MatchProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MatchProvider>
  </React.StrictMode>
);
