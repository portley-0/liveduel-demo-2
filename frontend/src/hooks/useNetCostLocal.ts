import { useEffect, useState } from "react";
import { Address } from "viem";
import {
  netCostBuyMicro,
  netProceedsSellMicro,
} from "@/lib/lmsr-local.ts";

type Status = "loading" | "deploying" | "not_deployed" | "ready";

export function useNetCostLocal(
  marketState: { qMicro: [bigint, bigint, bigint] | null; bMicro: bigint | null },
  marketAddress: Address | null,   // kept for parity; not used in math
  outcome: 0 | 1 | 2 | null,
  amountMicro: bigint | null,
  tradeType: "buy" | "sell",
  marketStatus: Status
) {
  const [netCost, setNetCost] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      marketStatus !== "ready" ||
      !marketState.qMicro ||
      !marketState.bMicro ||
      !marketAddress ||          // keep same guards as your old hook
      outcome === null ||
      !amountMicro ||
      amountMicro <= 0n
    ) {
      setNetCost(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const k = outcome as 0 | 1 | 2;
      const val =
        tradeType === "buy"
          ? netCostBuyMicro(marketState.qMicro, marketState.bMicro, k, amountMicro)
          : netProceedsSellMicro(marketState.qMicro, marketState.bMicro, k, amountMicro);
      setNetCost(val);
    } catch (e) {
      console.error("Local LMSR net cost failed:", e);
      setError("Local LMSR calculation failed");
      setNetCost(null);
    } finally {
      setIsLoading(false);
    }
  }, [marketStatus, marketState.qMicro, marketState.bMicro, marketAddress, outcome, amountMicro, tradeType]);

  return { data: netCost, isLoading, error };
}
