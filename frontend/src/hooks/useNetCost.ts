import { useState, useEffect } from "react";
import { ethers } from "ethers";
import PredictionMarketABI from "@/abis/PredictionMarket.json" with { type: "json" };
import { Address } from "viem";
import { usePublicClient } from "wagmi"; 

export function useNetCost(marketAddress: Address | null, outcome: number | null, amount: bigint | null) {
  const [netCost, setNetCost] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wagmiClient = usePublicClient(); // Wagmi client

  useEffect(() => {
    if (!marketAddress || outcome === null || !amount || amount <= 0n || !wagmiClient) {
      setNetCost(null);
      return;
    }

    // ✅ Convert Wagmi provider into an Ethers.js provider
    const provider = new ethers.JsonRpcProvider(wagmiClient.transport.url);

    const fetchNetCost = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const contract = new ethers.Contract(marketAddress, PredictionMarketABI.abi, provider);
        const cost = await contract.getNetCost(outcome, amount);
        setNetCost(BigInt(cost.toString()));
      } catch (err) {
        console.error("Error fetching net cost:", err);
        setError("Failed to fetch net cost");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNetCost();
  }, [marketAddress, outcome, amount, wagmiClient]);

  return { data: netCost, isLoading, error };
}
