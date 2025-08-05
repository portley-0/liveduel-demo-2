import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MatchProvider } from "@/context/MatchContext.tsx";
import { TournamentProvider } from "@/context/TournamentContext.tsx";
import WalletProvider from "@/context/WalletProvider.tsx";
import { FilterProvider } from "@/context/FilterContext.tsx";
import { AuthTransitionProvider } from "@/context/AuthTransitionContext.tsx";
import "./styles/tailwind.css";
import { Buffer } from "buffer";

window.global = window;
import process from "process";
window.Buffer = Buffer;
window.process = process;

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <WalletProvider> 
        <AuthTransitionProvider>
          <FilterProvider>
            <MatchProvider>
            <TournamentProvider>
              <App />
            </TournamentProvider>
            </MatchProvider>
          </FilterProvider>
        </AuthTransitionProvider>
      </WalletProvider>
    </QueryClientProvider>
  </BrowserRouter>
);
