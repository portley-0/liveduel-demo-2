import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { MatchProvider } from "@/context/MatchContext.tsx";
import { TournamentProvider } from "@/context/TournamentContext.tsx";
import WalletProvider from "@/context/WalletProvider.tsx";
import { FilterProvider } from "@/context/FilterContext.tsx";
import "./styles/tailwind.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <WalletProvider> 
    <FilterProvider>
      <MatchProvider>
      <TournamentProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TournamentProvider>
      </MatchProvider>
    </FilterProvider>
  </WalletProvider>
);
