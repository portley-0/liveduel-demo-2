import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { MatchData } from "@/types/MatchData.ts";
import { useMarketFactory } from "@/hooks/useMarketFactory.ts";
import { useNetCost } from "@/hooks/useNetCost.ts";
import { BsArrowDownUp } from "react-icons/bs";
import { PiCaretUpDownBold } from "react-icons/pi";
import { GoArrowUpRight, GoArrowDownRight } from "react-icons/go";
import { TbCircleLetterDFilled } from "react-icons/tb";
import PredictionMarketABI from "@/abis/PredictionMarket.json" with { type: "json" };
import ConditionalTokensABI from "@/abis/ConditionalTokens.json" with { type: "json" };
import MarketFactoryABI from "@/abis/MarketFactory.json" with { type: "json" };
import MockUSDCABI from "@/abis/MockUSDC.json" with { type: "json" };
import { ethers } from "ethers";
import { useWalletClient } from "wagmi";

const DEFAULT_PROB = 0.3333333; // latest odds as probability (i.e. 33.33333%)
const DEFAULT_DECIMAL_ODDS = 3.0; // display value if needed
const USDC_ADDRESS = "0xB1cC53DfF11c564Fbe22145a0b07588e7648db74";
const CONDITIONAL_TOKENS_ADDRESS = "0x988A02b302AE410CA71f6A10ad218Da5c70b9f5a";
const MARKET_FACTORY_ADDRESS = "0x9b532eB694eC397f6eB6C22e450F95222Cb3b1dd";
const USDC_ABI = MockUSDCABI.abi;
const CONDITIONAL_TOKENS_ABI = ConditionalTokensABI.abi;
const MARKET_FACTORY_ABI = MarketFactoryABI.abi;
const SERVER_URL = import.meta.env.VITE_SERVER_URL;

// This function converts a probability (e.g. 0.3333333) to decimal odds (e.g. 3.0) if needed.
function convertToDecimalOdds(probability: number): number {
  return probability > 0 ? 1 / probability : 10.0;
}

const Betting: React.FC<{ match: MatchData }> = ({ match }) => {
  const [selectedBet, setSelectedBet] = useState<"home" | "draw" | "away" | null>(null);
  const [betAmount, setBetAmount] = useState<string>("");
  const [expanded, setExpanded] = useState(false);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const { data: marketAddress, isLoading, refetch } = useMarketFactory(match.matchId);
  const [deployedMarket, setDeployedMarket] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [marketStatus, setMarketStatus] = useState<"loading" | "deploying" | "not_deployed" | "ready">("loading");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isTxPending, setIsTxPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();
  const [refreshKey, setRefreshKey] = useState(0);
  // Latest odds are stored as probabilities.
  const [homePrice, setHomePrice] = useState<number>(DEFAULT_PROB);
  const [drawPrice, setDrawPrice] = useState<number>(DEFAULT_PROB);
  const [awayPrice, setAwayPrice] = useState<number>(DEFAULT_PROB);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ shares: 0, cost: 0 });
  const [outcomeBalance, setOutcomeBalance] = useState<string | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [conditionId, setConditionId] = useState<string | null>(null);
  const [outcomeTokenIds, setOutcomeTokenIds] = useState<{ [key: number]: string }>({});

  const closeModal = () => setIsModalOpen(false);

  const fetchConditionId = async () => {
    if (!walletClient || !match.matchId || !marketAddress) return;
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const marketFactory = new ethers.Contract(MARKET_FACTORY_ADDRESS, MARKET_FACTORY_ABI, signer);
      const fetchedId = await marketFactory.matchConditionIds(match.matchId);
      if (fetchedId !== conditionId) {
        setConditionId(fetchedId);
        const conditionalTokensContract = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, CONDITIONAL_TOKENS_ABI, signer);
        const tokens: { [key: number]: string } = {};
        for (let i = 0; i < 3; i++) {
          const indexSet = 1 << i;
          const collectionId = await conditionalTokensContract.getCollectionId(ethers.ZeroHash, fetchedId, indexSet);
          const positionId = await conditionalTokensContract.getPositionId(USDC_ADDRESS, collectionId);
          tokens[i] = positionId;
        }
        setOutcomeTokenIds(tokens);
      }
    } catch (error) {
      console.error("Error fetching conditionId or outcome token IDs:", error);
    }
  };

  useEffect(() => {
    fetchConditionId();
  }, [walletClient, match.matchId, marketAddress]);

  useEffect(() => {
    if (tradeType !== "sell" || !walletClient || !marketAddress || selectedBet === null || !conditionId) return;
    const timeout = setTimeout(() => {
      fetchOutcomeBalance();
    }, 250);
    return () => clearTimeout(timeout);
  }, [tradeType, selectedBet, walletClient, marketAddress, conditionId]);

  useEffect(() => {
    if (tradeType === "buy") {
      setOutcomeBalance(null);
      setIsBalanceLoading(false);
    }
  }, [tradeType]);

  useEffect(() => {
    if (isLoading) {
      setMarketStatus("loading");
    } else if (isDeploying) {
      setMarketStatus("deploying");
    } else if (!marketAddress && !deployedMarket) {
      setMarketStatus("not_deployed");
    } else {
      setMarketStatus("ready");
    }
  }, [isLoading, isDeploying, marketAddress, deployedMarket]);

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [match.latestOdds]);

  const betMapping: { [key in "home" | "draw" | "away"]: number } = {
    home: 0,
    draw: 1,
    away: 2,
  };

  const isValidBet = selectedBet !== null && betAmount !== "";
  const numericBetAmount = parseFloat(betAmount || "0");
  const betAmountBigInt = isValidBet ? BigInt(Math.round(numericBetAmount * 1_000_000)) : null;
  const { data: netCost, isLoading: isFetchingNetCost } = useNetCost(
    marketAddress,
    isValidBet ? betMapping[selectedBet!] : null,
    betAmountBigInt,
    tradeType,
    marketStatus
  );
  const fee = netCost ? (netCost * 4n) / 100n : 0n;
  const totalCost = netCost ? netCost + fee : 0n;

  const sendTransaction = async (contractAddress: string, functionName: string, args: any[]) => {
    if (!walletClient) {
      console.error("No wallet connected.");
      return;
    }
    try {
      setIsTxPending(true);
      setIsSuccess(false);
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, PredictionMarketABI.abi, signer);
      const tx = await contract[functionName](...args);
      setTxHash(tx.hash);
      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);
      setIsSuccess(true);
      refetch();
    } catch (error) {
      console.error("Transaction failed:", error);
    } finally {
      setIsTxPending(false);
    }
  };

  const approveContracts = async (which: "buy" | "sell") => {
    if (!walletClient || !marketAddress) {
      console.error("No wallet or market address.");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      if (which === "buy") {
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
        console.log(`Approving USDC for total cost: ${totalCost.toString()}`);
        const approveTx = await usdcContract.approve(marketAddress, totalCost);
        await approveTx.wait();
        console.log("USDC approved.");
      }
      if (which === "sell") {
        const conditionalTokensContract = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, CONDITIONAL_TOKENS_ABI, signer);
        console.log("Approving Conditional Tokens...");
        const approveCTx = await conditionalTokensContract.setApprovalForAll(marketAddress, true);
        await approveCTx.wait();
        console.log("Conditional Tokens approved.");
      }
    } catch (error) {
      console.error("Approval transaction failed:", error);
    }
  };

  const fetchOutcomeBalance = async () => {
    if (!walletClient || !marketAddress || selectedBet === null || !conditionId) return;
    setIsBalanceLoading(true);
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const conditionalTokensContract = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, CONDITIONAL_TOKENS_ABI, signer);
      const outcomeIndex = betMapping[selectedBet];
      const tokenId = outcomeTokenIds[outcomeIndex];
      const balance = await conditionalTokensContract.balanceOf(userAddress, tokenId);
      setOutcomeBalance((Number(balance) / 1e6).toFixed(2));
    } catch (error) {
      console.error("Failed to fetch outcome balance:", error);
      setOutcomeBalance(null);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const buyShares = async () => {
    if (!walletClient) {
      console.error("No wallet connected. Opening connect modal.");
      openConnectModal?.();
      return;
    }
    if (!marketAddress || !isValidBet) return;
    await approveContracts("buy");
    try {
      await sendTransaction(marketAddress, "buyShares", [betMapping[selectedBet!], betAmountBigInt]);
      setModalData({ shares: numericBetAmount, cost: Number(totalCost) / 1e6 });
      setIsModalOpen(true);
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  };

  const sellShares = async () => {
    if (!walletClient) {
      console.error("No wallet connected. Opening connect modal.");
      openConnectModal?.();
      return;
    }
    if (!marketAddress || !isValidBet) return;
    await approveContracts("sell");
    try {
      await sendTransaction(marketAddress, "sellShares", [betMapping[selectedBet!], betAmountBigInt]);
      setModalData({ shares: numericBetAmount, cost: Number(netCost) / 1e6 });
      setIsModalOpen(true);
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      console.log("Transaction confirmed. Refetching market data...");
      refetch();
    }
  }, [isSuccess, refetch]);

  useEffect(() => {
    if (match.latestOdds) {
      setHomePrice(match.latestOdds.home ?? DEFAULT_PROB);
      setDrawPrice(match.latestOdds.draw ?? DEFAULT_PROB);
      setAwayPrice(match.latestOdds.away ?? DEFAULT_PROB);
    }
  }, [match.latestOdds]);

  const deployMarket = async () => {
    if (isDeploying || marketAddress || deployedMarket) return;
    setIsDeploying(true);
    try {
      console.log(`Deploying market for match ${match.matchId}...`);
      const response = await fetch(`${SERVER_URL}/deploy`, {
        method: "POST",
        body: JSON.stringify({ matchId: match.matchId, matchTimestamp: match.matchTimestamp }),
        headers: { "Content-Type": "application/json" },
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Invalid JSON response:", text);
        throw new Error("Server returned invalid JSON");
      }
      if (!response.ok) {
        console.error("Deployment failed:", data);
        throw new Error(data?.message || "Deployment failed");
      }
      console.log("Market Deployed:", data.newMarketAddress);
      setDeployedMarket(data.newMarketAddress);
      refetch();
    } catch (error) {
      console.error("Deployment Error:", error);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSelectBet = (outcome: "home" | "draw" | "away") => {
    setSelectedBet(outcome);
    if (!marketAddress && !deployedMarket) {
      deployMarket();
    }
  };

  // Compute previous odds from oddsHistory (if available) by converting stored decimal odds back to probabilities.
  const prevOdds = (() => {
    const histCount = match.oddsHistory?.timestamps?.length ?? 0;
    if (histCount >= 2) {
      return {
        home:
          match.oddsHistory!.homeOdds[histCount - 2] !== undefined
            ? 1 / match.oddsHistory!.homeOdds[histCount - 2]
            : match.latestOdds?.home ?? DEFAULT_PROB,
        draw:
          match.oddsHistory!.drawOdds[histCount - 2] !== undefined
            ? 1 / match.oddsHistory!.drawOdds[histCount - 2]
            : match.latestOdds?.draw ?? DEFAULT_PROB,
        away:
          match.oddsHistory!.awayOdds[histCount - 2] !== undefined
            ? 1 / match.oddsHistory!.awayOdds[histCount - 2]
            : match.latestOdds?.away ?? DEFAULT_PROB,
      };
    } else {
      return {
        home: DEFAULT_PROB,
        draw: DEFAULT_PROB,
        away: DEFAULT_PROB,
      };
    }
  })();

  // Arrow icon logic: compare probabilities.
  // Show neutral icon only when current probability equals 0.3333333 (within a very small tolerance).
  function getOddsMovementIcon(prev: number, current: number) {
    const NEUTRAL_PROB = 0.3333333;
    const tol = 1e-7;
    if (Math.abs(current - NEUTRAL_PROB) < tol) {
      return <BsArrowDownUp className="text-gray-400 text-lg" />;
    }
    if (current > prev) {
      return <GoArrowUpRight className="text-green-400 text-lg" />;
    }
    if (current < prev) {
      return <GoArrowDownRight className="text-red-500 text-lg" />;
    }
    return <BsArrowDownUp className="text-gray-400 text-lg" />;
  }

  return (
    <div className="bg-greyblue p-4 rounded-2xl text-white shadow-md">
      <div className="flex items-center mb-3">
        <h2 className="text-xl font-bold pr-2">Full Time</h2>
        <div className="flex space-x-1">
          <button
            className={`px-1.5 py-0.75 text-[13px] font-semibold border-2 rounded text-white ${
              tradeType === "buy"
                ? "bg-blue-500 border-blue-700"
                : "bg-greyblue border-gray-500 hover:bg-hovergreyblue"
            }`}
            onClick={() => setTradeType("buy")}
          >
            BUY
          </button>
          <button
            className={`px-1.5 py-0.75 text-[13px] font-semibold border-2 rounded text-white ${
              tradeType === "sell"
                ? "bg-red-500 border-red-700"
                : "bg-greyblue border-gray-500 hover:bg-hovergreyblue"
            }`}
            onClick={() => setTradeType("sell")}
          >
            SELL
          </button>
        </div>
      </div>

      <div className="flex space-x-4 sm:space-x-2 xs:space-x-2 justify-center mb-1">
        {(["home", "draw", "away"] as const).map((outcome) => {
          // Use latest odds as probability.
          const price = outcome === "home" ? homePrice : outcome === "draw" ? drawPrice : awayPrice;
          const isSelected = selectedBet === outcome;
          const prevVal = prevOdds[outcome];
          const borderColor =
            isSelected && tradeType === "buy"
              ? "border-blue-500"
              : isSelected && tradeType === "sell"
              ? "border-red-600"
              : "border-gray-400";

          return (
            <button
              key={`bet-button-${outcome}-${refreshKey}`}
              className={`border-2 shadow-md ${borderColor} text-white font-semibold 
                w-[128px] h-[45px] 
                md:w-[125px] md:h-[43px] 
                sm:w-[117px] sm:h-[42px] 
                xs:w-[107px] xs:h-[40px] 
                min-w-[105px] flex-shrink-0
                flex items-center justify-center space-x-2 transition-all 
                rounded-full focus:outline-none focus:ring-0 ${
                  isSelected ? "bg-hovergreyblue" : "bg-greyblue hover:bg-hovergreyblue"
                }`}
              onClick={() => handleSelectBet(outcome)}
            >
              {outcome === "draw" ? (
                <TbCircleLetterDFilled className="text-gray-400 text-[35px] md:text-[31px] sm:text-[29px] xs:text-[27px]" />
              ) : (
                <img
                  src={outcome === "home" ? match.homeTeamLogo : match.awayTeamLogo}
                  alt={outcome}
                  className="w-[34px] h-[34px] md:w-[30px] md:h-[30px] sm:w-[28px] sm:h-[28px] xs:w-[26px] xs:h-[26px] object-contain"
                />
              )}
              <span className="text-xl md:text-lg sm:text-base xs:text-sm">${price.toFixed(2)}</span>
              {getOddsMovementIcon(prevVal, price)}
            </button>
          );
        })}
      </div>

      {!expanded && (
        <button
          className="w-full mt-2 flex items-center justify-center text-white text-md font-semibold space-x-2"
          onClick={() => setExpanded(true)}
        >
          <PiCaretUpDownBold className="text-lg" />
          <span>More Betting Options</span>
        </button>
      )}

      {expanded && (
        <>
          <div className="p-1 w-full">
            <label className="block text-md font-semibold">
              {tradeType === "buy" ? "Enter Outcome Shares To Buy" : "Enter Outcome Shares To Sell"}
            </label>
            {tradeType === "sell" && (
              <p>
                <strong className="text-sm">Balance: </strong>
                {isBalanceLoading ? "Checking..." : outcomeBalance !== null ? `${outcomeBalance} Shares` : "N/A"}
              </p>
            )}
            <input
              type="number"
              min="0"
              className="w-full p-2 mt-2 focus:outline-none focus:ring-0 rounded bg-darkblue text-white text-lg"
              placeholder={marketStatus !== "ready" ? "Market not deployed" : "Enter share amount"}
              value={betAmount}
              onChange={(e) => {
                if (marketStatus !== "ready") return;
                const val = e.target.value.replace(/[^0-9.]/g, "");
                setBetAmount(val);
              }}
              disabled={marketStatus !== "ready"}
            />
            <div className="mt-3 text-sm text-white">
              <p>
                <strong>{tradeType === "buy" ? "LMSR Net Cost:" : "You Receive:"}</strong>
                {selectedBet === null || betAmount === ""
                  ? " $0.00 USDC"
                  : isFetchingNetCost
                  ? " Loading..."
                  : netCost !== null
                  ? ` $${(Number(netCost) / 1e6).toFixed(2)} USDC`
                  : " Error"}
              </p>
              {tradeType === "buy" && (
                <>
                  <p>
                    <strong>Transaction Fee (4%):</strong>
                    {selectedBet === null || betAmount === ""
                      ? " $0.00 USDC"
                      : fee
                      ? ` $${(Number(fee) / 1e6).toFixed(2)} USDC`
                      : " Calculating..."}
                  </p>
                  <p>
                    <strong>Total Cost:</strong>
                    {selectedBet === null || betAmount === ""
                      ? " $0.00 USDC"
                      : totalCost
                      ? ` $${(Number(totalCost) / 1e6).toFixed(2)} USDC`
                      : " Calculating..."}
                  </p>
                </>
              )}
              {marketStatus === "loading" && (
                <p className="text-white font-semibold mt-2">🔄 Checking market status...</p>
              )}
              {marketStatus === "deploying" && (
                <p className="text-white font-semibold mt-2">⏳ Deploying market... Please wait.</p>
              )}
              {marketStatus === "not_deployed" && !isDeploying && (
                <p className="text-white font-semibold mt-2">
                  ⚠️ Market contract not deployed. Select an outcome to deploy.
                </p>
              )}
            </div>
            <button
              className={`btn w-full mt-4 py-2 h-[45px] text-lg font-semibold border-2 rounded-full text-white transition-all 
                ${
                  isTxPending
                    ? "bg-gray-400 border-gray-300 text-white cursor-not-allowed"
                    : tradeType === "buy"
                    ? "bg-blue-500 hover:bg-blue-600 border-blue-700 hover:border-blue-700"
                    : "bg-red-500 hover:bg-red-600 border-red-700 hover:border-red-700"
                }`}
              onClick={tradeType === "buy" ? buyShares : sellShares}
              disabled={isTxPending}
            >
              {isTxPending ? "Processing..." : tradeType === "buy" ? "BUY" : "SELL"}
            </button>
          </div>
          <button
            className="w-full mt-2 flex items-center justify-center text-white text-md font-semibold space-x-2"
            onClick={() => setExpanded(false)}
          >
            <PiCaretUpDownBold className="text-lg transform rotate-180" />
            <span>Hide</span>
          </button>
        </>
      )}

      <Dialog open={isModalOpen} onClose={closeModal} className="fixed inset-0 flex items-center justify-center z-50">
        <div className="fixed inset-0 bg-black opacity-50"></div>
        <div className="bg-greyblue p-6 rounded-lg shadow-lg w-auto max-w-md sm:max-w-xs mx-auto text-center relative z-50">
          <h2 className="text-white text-2xl sm:text-xl font-semibold mb-3">Success</h2>
          <p className="text-gray-300 text-lg sm:text-base">
            {tradeType === "buy" ? "You purchased" : "You sold"}{" "}
            <span className="text-white font-bold">{modalData.shares}</span> outcome shares
          </p>
          <p className="text-gray-300 text-lg sm:text-base">
            for <span className="text-white font-bold">${modalData.cost.toFixed(2)}</span> USDC
          </p>
          <button
            className="mt-4 bg-greyblue border-2 border-white hover:border-blue-500 text-white font-semibold px-6 py-2 sm:px-4 sm:py-1.5 rounded-full transition"
            onClick={closeModal}
          >
            Continue
          </button>
        </div>
      </Dialog>
    </div>
  );
};

export default Betting;
