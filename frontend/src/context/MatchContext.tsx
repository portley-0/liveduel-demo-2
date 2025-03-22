"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { MatchData } from "../types/MatchData.ts";

const SOCKET_SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const FIXED_192x64_SCALING_FACTOR = BigInt("18446744073709551616");

function convert192x64ToDecimal(fixedVal: number): number {
  const bigVal = BigInt(fixedVal);
  const scaled = (bigVal * 10000n) / FIXED_192x64_SCALING_FACTOR;
  return Number(scaled) / 10000;
}

function decimalProbabilityToOdds(prob: number): number {
  return prob > 0 ? 1 / prob : 10;
}

interface ChartPoint {
  timestamp: number;
  home: number; 
  draw: number;
  away: number;
}

function buildChartData(oddsHistory: {
  timestamps: number[];
  homeOdds: number[];
  drawOdds: number[];
  awayOdds: number[];
}): ChartPoint[] {
  if (!oddsHistory?.timestamps?.length) return [];
  return oddsHistory.timestamps.map((ts, i) => {
    const homeProb = convert192x64ToDecimal(oddsHistory.homeOdds[i] ?? 6148914691236516864);
    const drawProb = convert192x64ToDecimal(oddsHistory.drawOdds[i] ?? 6148914691236516864);
    const awayProb = convert192x64ToDecimal(oddsHistory.awayOdds[i] ?? 6148914691236516864);

    return {
      timestamp: ts,
      home: decimalProbabilityToOdds(homeProb),
      draw: decimalProbabilityToOdds(drawProb),
      away: decimalProbabilityToOdds(awayProb),
    };
  });
}

function mergeChartPoints(oldData: ChartPoint[], newData: ChartPoint[]): ChartPoint[] {
  return [...oldData, ...newData]
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((item, idx, arr) => idx === 0 || item.timestamp !== arr[idx - 1].timestamp);
}

function mergeOddsHistoryArrays(
  oldHistory?: {
    timestamps: number[];
    homeOdds: number[];
    drawOdds: number[];
    awayOdds: number[];
  },
  newHistory?: {
    timestamps: number[];
    homeOdds: number[];
    drawOdds: number[];
    awayOdds: number[];
  }
) {
  if (!oldHistory) return newHistory;
  if (!newHistory) return oldHistory;

  const mergedTimestamps = [...oldHistory.timestamps, ...newHistory.timestamps];
  const mergedHome = [...oldHistory.homeOdds, ...newHistory.homeOdds];
  const mergedDraw = [...oldHistory.drawOdds, ...newHistory.drawOdds];
  const mergedAway = [...oldHistory.awayOdds, ...newHistory.awayOdds];

  const combined = mergedTimestamps.map((ts, i) => ({
    ts,
    home: mergedHome[i],
    draw: mergedDraw[i],
    away: mergedAway[i],
  }));

  combined.sort((a, b) => a.ts - b.ts);

  const deduped: typeof combined = [];
  for (let item of combined) {
    if (!deduped.length || deduped[deduped.length - 1].ts !== item.ts) {
      deduped.push(item);
    }
  }

  return {
    timestamps: deduped.map((d) => d.ts),
    homeOdds: deduped.map((d) => d.home),
    drawOdds: deduped.map((d) => d.draw),
    awayOdds: deduped.map((d) => d.away),
  };
}

function generateFlatlineChartData(homeProb: number, drawProb: number, awayProb: number): ChartPoint[] {
  const now = Date.now();
  const points = Array.from({ length: 10 }, (_, i) => {
    const ts = now - i * 60_000;
    return {
      timestamp: ts,
      home: decimalProbabilityToOdds(homeProb),
      draw: decimalProbabilityToOdds(drawProb),
      away: decimalProbabilityToOdds(awayProb),
    };
  });
  return points.reverse();
}

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
        const finalOdds = {
          home: convert192x64ToDecimal(match.latestOdds?.home ?? 6148914691236516864),
          draw: convert192x64ToDecimal(match.latestOdds?.draw ?? 6148914691236516864),
          away: convert192x64ToDecimal(match.latestOdds?.away ?? 6148914691236516864),
        };

        let chartData = match.oddsHistory ? buildChartData(match.oddsHistory) : [];
        if (chartData.length === 0) {
          chartData = generateFlatlineChartData(finalOdds.home, finalOdds.draw, finalOdds.away);
        }

        acc[match.matchId] = {
          ...match,
          latestOdds: finalOdds,
          chartData,
        };
        return acc;
      }, {});

      setMatches(matchMap);
    };

    const onMatchUpdate = (updatedMatch: MatchData) => {
      console.log("[WebSocket] Match update received:", updatedMatch);

      setMatches((prev) => {
        const old = prev[updatedMatch.matchId];

        if (!old) {
          const finalOdds = {
            home: convert192x64ToDecimal(updatedMatch.latestOdds?.home ?? 6148914691236516864),
            draw: convert192x64ToDecimal(updatedMatch.latestOdds?.draw ?? 6148914691236516864),
            away: convert192x64ToDecimal(updatedMatch.latestOdds?.away ?? 6148914691236516864),
          };
          let cd = updatedMatch.oddsHistory ? buildChartData(updatedMatch.oddsHistory) : [];
          if (cd.length === 0) {
            cd = generateFlatlineChartData(finalOdds.home, finalOdds.draw, finalOdds.away);
          }

          return {
            ...prev,
            [updatedMatch.matchId]: {
              ...updatedMatch,
              latestOdds: finalOdds,
              chartData: cd,
            },
          };
        }

        const mergedOddsHistory = mergeOddsHistoryArrays(old.oddsHistory, updatedMatch.oddsHistory);
        const freshChartData = updatedMatch.oddsHistory ? buildChartData(updatedMatch.oddsHistory) : [];

        const newChartData = mergeChartPoints(old.chartData || [], freshChartData);

        const finalOdds = {
          home: convert192x64ToDecimal(updatedMatch.latestOdds?.home ?? 6148914691236516864),
          draw: convert192x64ToDecimal(updatedMatch.latestOdds?.draw ?? 6148914691236516864),
          away: convert192x64ToDecimal(updatedMatch.latestOdds?.away ?? 6148914691236516864),
        };

        const finalChartData =
          newChartData.length === 0
            ? generateFlatlineChartData(finalOdds.home, finalOdds.draw, finalOdds.away)
            : newChartData;

        const finalMatch: MatchData = {
          ...old,
          ...updatedMatch,
          oddsHistory: mergedOddsHistory,
          chartData: finalChartData,
          latestOdds: finalOdds,
        };

        return {
          ...prev,
          [updatedMatch.matchId]: finalMatch,
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
