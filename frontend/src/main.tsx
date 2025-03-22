import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { MatchProvider } from "@/context/MatchContext.tsx";
import WalletProvider from "@/context/WalletProvider.tsx";
import "./styles/tailwind.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <WalletProvider> 
    <MatchProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MatchProvider>
  </WalletProvider>
);
