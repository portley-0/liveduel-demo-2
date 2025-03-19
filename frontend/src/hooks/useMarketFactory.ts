import { useReadContract } from "wagmi";
import MarketFactory from "@/abis/MarketFactory.json" with { type: "json" };
const MarketFactoryABI = MarketFactory.abi;
import { Address } from "viem";

const MARKET_FACTORY_ADDRESS: Address = "0x9b532eB694eC397f6eB6C22e450F95222Cb3b1dd"; 

export function useMarketFactory(matchId: number) {
  return useReadContract({
    address: MARKET_FACTORY_ADDRESS,
    abi: MarketFactoryABI,
    functionName: "getPredictionMarket",
    args: [matchId],
  });
}
