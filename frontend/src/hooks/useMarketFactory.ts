// src/hooks/useMarketFactory.ts
import { useEffect, useState, useCallback } from "react";
import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";
import MarketFactory from "@/abis/MarketFactory.json" with { type: "json" };

const PUBLIC_CLIENT = createPublicClient({
  chain: avalancheFuji,
  transport: http(),
});

const MARKET_FACTORY_ADDRESS = "0x16c6de1080DFF475F7F248D63db60eB93563DD8F" as `0x${string}`;

export function useMarketFactory(matchId: number) {
  const [data, setData] = useState<`0x${string}` | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchMarket = useCallback(async () => {
    setIsLoading(true);
    try {
      const marketAddress = await PUBLIC_CLIENT.readContract({
        address: MARKET_FACTORY_ADDRESS,
        abi: MarketFactory.abi,
        functionName: "getPredictionMarket",
        args: [matchId],
      });
      setData((marketAddress as `0x${string}`) ?? null);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (typeof matchId === "number") {
      void fetchMarket();
    }
  }, [fetchMarket]);

  const refetch = fetchMarket;

  return { data, isLoading, error, refetch };
}
