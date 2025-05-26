import { useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import MarketFactory from "@/abis/MarketFactory.json" with { type: "json" };
import { Address } from "viem";

const MARKET_FACTORY_ADDRESS: Address = "0x8AA9335F486aef5d0881B09304109fBc67a6c8C3";

export function useTournamentMarketFactory(tournamentId: number) {
  const queryClient = useQueryClient();

  const result = useReadContract({
    address: MARKET_FACTORY_ADDRESS,
    abi: MarketFactory.abi,
    functionName: "getTournamentMarket",
    args: [tournamentId],
  });

  const marketAddress = (result.data as `0x${string}` | null) ?? null;

  const refetch = () => queryClient.invalidateQueries({ queryKey: result.queryKey });

  return { ...result, data: marketAddress, refetch };
}