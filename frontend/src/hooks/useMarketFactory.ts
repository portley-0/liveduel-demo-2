import { useReadContract } from "wagmi";
import MarketFactory from "@/abis/MarketFactory.json" with { type: "json" };
const MarketFactoryABI = MarketFactory.abi;
import { Address } from "viem";

const MARKET_FACTORY_ADDRESS: Address = "0x5EBf1a84158d38f000c5045ED6854Bcc752E9D6b"; 

export function useMarketFactory(matchId: number) {
  return useReadContract({
    address: MARKET_FACTORY_ADDRESS,
    abi: MarketFactoryABI,
    functionName: "getPredictionMarket",
    args: [matchId],
  });
}
