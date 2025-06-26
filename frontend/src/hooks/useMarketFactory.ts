import { useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import MarketFactory from "@/abis/MarketFactory.json" with { type: "json" };
import { Address } from "viem";

const MARKET_FACTORY_ADDRESS: Address = "0x16c6de1080DFF475F7F248D63db60eB93563DD8F";

export function useMarketFactory(matchId: number) {
  const queryClient = useQueryClient();

  const result = useReadContract({
    address: MARKET_FACTORY_ADDRESS,
    abi: MarketFactory.abi,
    functionName: "getPredictionMarket",
    args: [matchId],
  });

  const marketAddress = (result.data as `0x${string}` | null) ?? null;

  const refetch = () => queryClient.invalidateQueries({ queryKey: result.queryKey });

  return { ...result, data: marketAddress, refetch };
}