"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { MatchData } from "../types/MatchData.ts";

const SOCKET_SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

interface MatchContextType {
  matches: Record<number, MatchData>;
}

const MatchContext = createContext<MatchContextType | undefined>(undefined);

export const MatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [matches, setMatches] = useState<Record<number, MatchData>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socketRef.current) {
      console.log(`[WebSocket] Connecting to ${SOCKET_SERVER_URL}...`);
      socketRef.current = io(SOCKET_SERVER_URL, {
        reconnection: true,
        transports: ["websocket"],
      });
    }

    const socket = socketRef.current;

    const onConnect = () => {
      console.log("[WebSocket] Connected to server");
      socket.emit("requestInitialCache");
    };

    const onInitialCache = (initialMatches: MatchData[]) => {
      console.log("[WebSocket] Initial match cache received:", initialMatches);
      if (!Array.isArray(initialMatches)) {
        console.error("[WebSocket] initialCache is NOT an array!", initialMatches);
        return;
      }

      const matchMap = initialMatches.reduce<Record<number, MatchData>>((acc, match) => {
        acc[match.matchId] = match;
        return acc;
      }, {});

      setMatches(matchMap);
    };

    const areArraysEqual = (a?: number[], b?: number[]) => {
      if (a === b) return true;
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };

    const onMatchUpdate = (updatedMatch: MatchData) => {
      setMatches((prev) => {
        const existingMatch = prev[updatedMatch.matchId];
        if (
          existingMatch &&
          areArraysEqual(existingMatch.oddsHistory?.homeOdds, updatedMatch.oddsHistory?.homeOdds) &&
          areArraysEqual(existingMatch.oddsHistory?.drawOdds, updatedMatch.oddsHistory?.drawOdds) &&
          areArraysEqual(existingMatch.oddsHistory?.awayOdds, updatedMatch.oddsHistory?.awayOdds)
        ) {
          return prev; 
        }
        return {
          ...prev,
          [updatedMatch.matchId]: updatedMatch,
        };
      });
    };
    

    const onDisconnect = (reason: string) => {
      console.warn(`[WebSocket] Disconnected: ${reason}`);
    };

    const onError = (error: any) => {
      console.error("[WebSocket] Connection Error:", error);
    };

    socket.on("connect", onConnect);
    socket.on("initialCache", onInitialCache);
    socket.on("matchUpdate", onMatchUpdate);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);

    return () => {
      console.log("[WebSocket] Cleaning up...");
      socket.off("connect", onConnect);
      socket.off("initialCache", onInitialCache);
      socket.off("matchUpdate", onMatchUpdate);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
    };
  }, []);

  return <MatchContext.Provider value={{ matches }}>{children}</MatchContext.Provider>;
};

export function useMatches(): MatchContextType {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error("useMatches must be used within a MatchProvider");
  }
  return context;
}
