// src/hooks/useNetCost.ts
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import PredictionMarketABI from "@/abis/PredictionMarket.json" with { type: "json" };

const AVALANCHE_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

export function useNetCost(
  marketAddress: string | null,
  outcome: number | null,
  amount: bigint | null,
  tradeType: "buy" | "sell",
  marketStatus: "loading" | "deploying" | "not_deployed" | "ready"
) {
  const [netCost, setNetCost] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketAddress || outcome === null || !amount || amount <= 0n || marketStatus !== "ready") {
      setNetCost(null);
      setIsLoading(false);
      return;
    }

    const provider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);

    const fetchNetCost = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const contract = new ethers.Contract(marketAddress, PredictionMarketABI.abi, provider);
        const raw = await contract.getNetCost(outcome, tradeType === "sell" ? -amount : amount);
        const cost = BigInt(raw.toString());
        setNetCost(tradeType === "sell" ? cost * -1n : cost);
      } catch (err) {
        console.error("Error fetching net cost:", err);
        setError("Failed to fetch net cost");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchNetCost();
  }, [marketAddress, outcome, amount, tradeType, marketStatus]);

  return { data: netCost, isLoading, error };
}
