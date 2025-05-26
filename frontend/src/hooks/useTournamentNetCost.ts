import { useReadContract } from "wagmi";
import TournamentMarketABI from "@/abis/TournamentMarket.json" with { type: "json" };
import { Address } from "viem";

export function useTournamentNetCost(
  marketAddress: Address | null,
  outcome: number | null,
  amount: bigint | null,
  tradeType: "buy" | "sell",
  marketStatus: "loading" | "deploying" | "not_deployed" | "ready"
) {
  const result = useReadContract({
    address: marketAddress ?? undefined,
    abi: TournamentMarketABI.abi,
    functionName: "getNetCost",
    args: outcome !== null && amount !== null ? [outcome, tradeType === "sell" ? -amount : amount] : undefined,
    query: {
      enabled: !!marketAddress && outcome !== null && amount !== null && amount > 0n && marketStatus === "ready",
    },
  });

  const netCost = result.data ? BigInt(result.data.toString()) : null;

  return {
    data: netCost,
    isLoading: result.isLoading,
    error: result.error?.message ?? null,
  };
}