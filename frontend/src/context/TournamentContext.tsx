"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { TournamentData } from "../types/TournamentData.ts";

const SOCKET_SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

interface TournamentContextType {
  tournaments: Record<number, TournamentData>;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tournaments, setTournaments] = useState<Record<number, TournamentData>>({});
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
      socket.emit("requestTournamentCache");
    };

    const onInitialCache = (initialTournaments: TournamentData[]) => {
      console.log("[WebSocket] Initial tournament cache received:", initialTournaments);
      if (!Array.isArray(initialTournaments)) {
        console.error("[WebSocket] initialTournamentCache is NOT an array!", initialTournaments);
        return;
      }

      const tournamentMap = initialTournaments.reduce<Record<number, TournamentData>>((acc, tournament) => {
        acc[tournament.tournamentId] = tournament;
        return acc;
      }, {});

      setTournaments(tournamentMap);
    };

    const areArraysEqual = (a?: number[], b?: number[]) => {
      if (a === b) return true;
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };

    const areOddsRecordsEqual = (
      a?: Record<number, number[]>,
      b?: Record<number, number[]>,
    ) => {
      if (a === b) return true;
      if (!a || !b) return false;
      const aKeys = Object.keys(a).map(Number);
      const bKeys = Object.keys(b).map(Number);
      if (aKeys.length !== bKeys.length) return false;
      for (const key of aKeys) {
        if (!b[key] || !areArraysEqual(a[key], b[key])) return false;
      }
      return true;
    };

    const areLatestOddsEqual = (
      a?: Record<number, number>,
      b?: Record<number, number>,
    ) => {
      if (a === b) return true;
      if (!a || !b) return false;
      const aKeys = Object.keys(a).map(Number);
      const bKeys = Object.keys(b).map(Number);
      if (aKeys.length !== bKeys.length) return false;
      for (const key of aKeys) {
        if (b[key] === undefined || a[key] !== b[key]) return false;
      }
      return true;
    };

    const onTournamentUpdate = (updatedTournament: TournamentData) => {
      setTournaments((prev) => {
        const existingTournament = prev[updatedTournament.tournamentId];
        if (
          existingTournament &&
          areArraysEqual(
            existingTournament.oddsHistory?.timestamps,
            updatedTournament.oddsHistory?.timestamps,
          ) &&
          areOddsRecordsEqual(
            existingTournament.oddsHistory?.teamOdds,
            updatedTournament.oddsHistory?.teamOdds,
          ) &&
          areLatestOddsEqual(existingTournament.latestOdds, updatedTournament.latestOdds)
        ) {
          return prev;
        }
        return {
          ...prev,
          [updatedTournament.tournamentId]: updatedTournament,
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
    socket.on("initialTournamentCache", onInitialCache);
    socket.on("tournamentUpdate", onTournamentUpdate);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);

    return () => {
      console.log("[WebSocket] Cleaning up...");
      socket.off("connect", onConnect);
      socket.off("initialTournamentCache", onInitialCache);
      socket.off("tournamentUpdate", onTournamentUpdate);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
    };
  }, []);

  return <TournamentContext.Provider value={{ tournaments }}>{children}</TournamentContext.Provider>;
};

export function useTournaments(): TournamentContextType {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error("useTournaments must be used within a TournamentProvider");
  }
  return context;
}