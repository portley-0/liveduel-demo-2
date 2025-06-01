import { useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import MarketFactory from "@/abis/MarketFactory.json" with { type: "json" };
import { Address } from "viem";

const MARKET_FACTORY_ADDRESS: Address = "0x222b0e8D3E29d639189BA84DB2c0C7b48Ed87f1D";

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