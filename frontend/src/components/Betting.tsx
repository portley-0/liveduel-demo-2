import React, { useState, useEffect, useRef } from "react";
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
import { Spinner } from './Spinner.tsx';

declare global {
  interface Window {
    ethereum?: any;
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}
 
const DEFAULT_PROB = 0.3333333; 
const USDC_ADDRESS = "0xbcfb190B2Af566Ebe6ce9CB4e08D077E2acD7908";
const CONDITIONAL_TOKENS_ADDRESS = "0xCF27A9c88633DeDAA711b9758BCc6A7A62d874d1";
const MARKET_FACTORY_ADDRESS = "0x47107c7b5413378282B80cAE60dD49707A0A2E00";
const USDC_ABI = MockUSDCABI.abi;
const CONDITIONAL_TOKENS_ABI = ConditionalTokensABI.abi;
const MARKET_FACTORY_ABI = MarketFactoryABI.abi;
const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const AVALANCHE_FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';

const SHARE_SCALE = 1000000n; 

const Betting: React.FC<{ match: MatchData }> = ({ match }) => {
  const [selectedBet, setSelectedBet] = useState<"home" | "draw" | "away" | null>(null);
  const [betAmount, setBetAmount] = useState<string>(""); // User enters USDC amount.
  const [expanded, setExpanded] = useState(true);
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
  const [homePrice, setHomePrice] = useState<number>(DEFAULT_PROB);
  const [drawPrice, setDrawPrice] = useState<number>(DEFAULT_PROB);
  const [awayPrice, setAwayPrice] = useState<number>(DEFAULT_PROB);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ shares: 0, cost: 0 });
  const [outcomeBalances, setOutcomeBalances] = useState<{ [key in "home" | "draw" | "away"]: number }>({ home: 0, draw: 0, away: 0 });
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [conditionId, setConditionId] = useState<string | null>(null);
  const [outcomeTokenIds, setOutcomeTokenIds] = useState<{ [key: number]: string }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastAddress, setToastAddress] = useState<string | null>(null);
  
  const [calculatedSharesScaled, setCalculatedSharesScaled] = useState<bigint | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calcTokenRef = useRef(0);

  const isResolved = !!match.resolvedAt;
  const areButtonsDisabled = isResolved || match.marketAvailable !== true;
  const closeModal = () => setIsModalOpen(false);

  const fetchConditionId = async (): Promise<void> => {
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
    // Trigger the fetch when the user enters sell mode AND all dependencies are ready
    if (tradeType === "sell" && marketAddress && walletClient && conditionId && Object.keys(outcomeTokenIds).length === 3) {
      fetchOutcomeBalances();
    } else {
      // Clear balances when not in sell mode
      setOutcomeBalances({ home: 0, draw: 0, away: 0 });
    }
    // Add `outcomeTokenIds` to the dependency array
  }, [tradeType, walletClient, marketAddress, conditionId, outcomeTokenIds]);


  useEffect(() => {
    if (isResolved) {
      setExpanded(false); 
    }
  }, [isResolved, setExpanded]);

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

  const publicProvider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);

  const getSigner = async () => {
    if (!walletClient) {
      console.log("No walletClient available");
      return null;
    }
    let provider;
    const anyClient = walletClient as any;
    if (anyClient.provider) {
      console.log("Using walletClient.provider for BrowserProvider");
      provider = new ethers.BrowserProvider(anyClient.provider);
    } else if (typeof window !== "undefined" && window.ethereum) {
      console.log("Using window.ethereum for BrowserProvider");
      provider = new ethers.BrowserProvider(window.ethereum);
    } else {
      console.log("Falling back to walletClient directly for BrowserProvider");
      provider = new ethers.BrowserProvider(walletClient as any);
    }
    const signer = await provider.getSigner();
    console.log("Signer obtained:", signer);
    return signer;
  };

  // Binary search helper: inverts getNetCost to determine the share amount (scaled by SHARE_SCALE)
  const getNetCostForShares = async (shares: bigint): Promise<bigint> => {
    if (!marketAddress || selectedBet === null)
      throw new Error("Missing prerequisites for net cost calculation");
    const provider = publicProvider;
    const predictionMarket = new ethers.Contract(marketAddress, PredictionMarketABI.abi, provider);
    const outcomeIndex = betMapping[selectedBet];
    const netCost: bigint = await predictionMarket.getNetCost(outcomeIndex, shares);
    return netCost;
  };

  async function findSharesForCost(
    targetCost: bigint,
    tolerance: bigint = 1n,
    maxIterations: number = 50
  ): Promise<bigint> {
    let initialGuess = BigInt(Math.round(numericBetAmount * 3)) * SHARE_SCALE;
    let lower = 0n;
    let upper = initialGuess;
    while ((await getNetCostForShares(upper)) < targetCost) {
      lower = upper;
      upper *= 2n;
    }
    let bestGuess = lower;
    for (let i = 0; i < maxIterations; i++) {
      const mid = (lower + upper) / 2n;
      const cost = await getNetCostForShares(mid);
      if (cost >= targetCost - tolerance && cost <= targetCost + tolerance) {
        return mid;
      }
      if (cost > targetCost) {
        upper = mid;
      } else {
        lower = mid;
      }
      bestGuess = mid;
    }
    return bestGuess;
  }

  const debouncedBetAmount = useDebounce(betAmount, 300);

  useEffect(() => {
    setCalculatedSharesScaled(null);

    calcTokenRef.current++;

    if (tradeType !== "buy" || !debouncedBetAmount || debouncedBetAmount === "" || !marketAddress || selectedBet === null) {
      return;
    }
    const currentToken = calcTokenRef.current;

    const calculateOutcomeShares = async () => {
      try {
        setIsCalculating(true);
        const userTotalCost = BigInt(Math.round(parseFloat(debouncedBetAmount) * 1_000_000));
        const targetNetCost = (userTotalCost * 100n) / 104n;
        const shares = await findSharesForCost(targetNetCost);
        if (currentToken === calcTokenRef.current) {
          setCalculatedSharesScaled(shares);
        }
      } catch (error) {
        console.error("Error calculating shares for cost:", error);
      } finally {
        // Only clear calculation status if this is the latest call.
        if (currentToken === calcTokenRef.current) {
          setIsCalculating(false);
        }
      }
    };

    calculateOutcomeShares();
  }, [debouncedBetAmount, selectedBet, marketAddress, tradeType, numericBetAmount]);

  
  const sendTransaction = async (
    contractAddress: string,
    functionName: string,
    args: any[],
    signer: ethers.Signer,
    options: { gasLimit?: ethers.BigNumberish } = {}
  ): Promise<any> => {
    try {
      setIsTxPending(true);
      setIsSuccess(false);
      const contract = new ethers.Contract(contractAddress, PredictionMarketABI.abi, signer);
      const gasEstimate = await contract[functionName].estimateGas(...args);
      
      // Apply 20% buffer using bigint arithmetic
      const gasLimit = (gasEstimate * BigInt(12)) / BigInt(10); // 20% buffer (1.2x)
      
      // Execute transaction with estimated gas
      const tx = await contract[functionName](...args, {
        gasLimit,
        ...options,
      });
      setTxHash(tx.hash);
      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait(1); // Single confirmation for speed
      console.log("Transaction confirmed:", receipt);
      if (receipt.status !== 1) {
        throw new Error("Transaction failed");
      }
      setIsSuccess(true);
      refetch();
      return receipt;
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    } finally {
      setIsTxPending(false);
    }
  };

  const buyShares = async () => {
    if (!walletClient) {
      console.error("No wallet connected. Opening connect modal.");
      openConnectModal?.();
      return;
    }
    if (!marketAddress || !selectedBet || calculatedSharesScaled === null) return;

    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      const approvalAmount = BigInt(Math.round(parseFloat(betAmount) * 1_000_000));
      const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour

      // EIP-712 Permit signature
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const nonce = await usdcContract.nonces(userAddress);
      const domain = {
        name: "Mock USDC",
        version: "1",
        chainId: 43113,
        verifyingContract: USDC_ADDRESS,
      };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const value = {
        owner: userAddress,
        spender: marketAddress,
        value: approvalAmount,
        nonce: nonce,
        deadline: deadline,
      };
      const signature = await signer.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);

      // Single transaction with permit
      const receipt = await sendTransaction(
        marketAddress,
        "buySharesWithPermit",
        [
          betMapping[selectedBet],
          calculatedSharesScaled,
          approvalAmount,
          deadline,
          v,
          r,
          s,
        ],
        signer
      );

      if (receipt && receipt.status === 1) {
        const displayShares = Number(calculatedSharesScaled) / Number(SHARE_SCALE);
        setModalData({ shares: displayShares, cost: parseFloat(betAmount) });
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error("Buy shares failed:", error);
    }
  };

  const sellShares = async (): Promise<void> => {
    if (!walletClient) {
      console.error("No wallet connected. Opening connect modal.");
      openConnectModal?.();
      return;
    }
    if (!marketAddress || !isValidBet) return;

    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // Check if approval is already set
      const conditionalTokensContract = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, CONDITIONAL_TOKENS_ABI, signer);
      const isApproved = await conditionalTokensContract.isApprovedForAll(userAddress, marketAddress);

      if (!isApproved) {
        const approveTx = await conditionalTokensContract.setApprovalForAll(marketAddress, true);
        await approveTx.wait();
        console.log("Approval for Conditional Tokens set");
      }

      // Send sellShares transaction
      const receipt = await sendTransaction(
        marketAddress,
        "sellShares",
        [betMapping[selectedBet!], betAmountBigInt],
        signer
      );

      if (receipt && receipt.status === 1) {
        setModalData({ shares: numericBetAmount, cost: Number(netCost) / 1e6 });
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error("Sell shares failed:", error);
    }
  };
  
  const fetchOutcomeBalances = async () => {
    if (!walletClient || !marketAddress || !conditionId || Object.keys(outcomeTokenIds).length < 3) return;
    setIsBalanceLoading(true);
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const conditionalTokensContract = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, CONDITIONAL_TOKENS_ABI, signer);

      const balances = { home: 0, draw: 0, away: 0 };
      // Loop through each outcome to fetch its balance
      for (const outcome of ["home", "draw", "away"] as const) {
        const outcomeIndex = betMapping[outcome];
        const tokenId = outcomeTokenIds[outcomeIndex];
        if (tokenId) {
          const balance = await conditionalTokensContract.balanceOf(userAddress, tokenId);
          // Store the numeric balance
          balances[outcome] = Number(balance) / 1e6;
        }
      }
      setOutcomeBalances(balances);
    } catch (error) {
      console.error("Failed to fetch outcome balances:", error);
      setOutcomeBalances({ home: 0, draw: 0, away: 0 });
    } finally {
      setIsBalanceLoading(false);
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
      setToastMessage("Market Deployment Success");
      setToastAddress(data.newMarketAddress);
      setTimeout(() => {
        setToastMessage(null);
        setToastAddress(null);
      }, 5000);
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
              tradeType === "buy" ? "bg-blue-500 border-blue-700" : "bg-greyblue border-gray-500 hover:bg-hovergreyblue"
            }`}
            onClick={() => setTradeType("buy")}
          >
            BUY
          </button>
          <button
            className={`px-1.5 py-0.75 text-[13px] font-semibold border-2 rounded text-white ${
              tradeType === "sell" ? "bg-red-500 border-red-700" : "bg-greyblue border-gray-500 hover:bg-hovergreyblue"
            }`}
            onClick={() => setTradeType("sell")}
          >
            SELL
          </button>
        </div>
      </div>
      <div className="flex space-x-4 sm:space-x-2 xs:space-x-1 xxs:space-x-1 justify-center mb-1">
        {(["home", "draw", "away"] as const).map((outcome) => {
          const price = outcome === "home" ? homePrice : outcome === "draw" ? drawPrice : awayPrice;
          const isSelected = selectedBet === outcome;
          const prevVal = prevOdds[outcome];
          const isSellDisabled = tradeType === "sell" && outcomeBalances[outcome] <= 0;
          const isButtonDisabled = areButtonsDisabled || isSellDisabled;
          const borderColor =
            isSelected && tradeType === "buy"
              ? "border-blue-500"
              : isSelected && tradeType === "sell"
              ? "border-red-600"
              : "border-gray-400";
          return (
            <button
              key={`bet-button-${outcome}-${refreshKey}`}
              disabled={isButtonDisabled}
              className={`border-2 shadow-md ${borderColor} text-white font-semibold 
                w-[128px] h-[45px] md:w-[125px] md:h-[43px] sm:w-[117px] sm:h-[42px] xs:w-[105px] xs:h-[38px] xxs:w-[92px] xxs:h-[35px]
                flex-shrink-0 flex items-center justify-center sm:space-x-2 xs:space-x-1.5 xxs:space-x-1 transition-all rounded-full focus:outline-none focus:ring-0 ${
                  isButtonDisabled ? "opacity-50 cursor-not-allowed" : isSelected ? "bg-hovergreyblue" : "bg-greyblue hover:bg-hovergreyblue"
                }`}
              onClick={() => !isButtonDisabled && handleSelectBet(outcome)} 
            >
              {outcome === "draw" ? (
                <TbCircleLetterDFilled className="text-gray-400 text-[35px] md:text-[31px] sm:text-[29px] xs:text-[27px] xxs:text-[23px]" />
              ) : (
                <img
                  src={outcome === "home" ? match.homeTeamLogo : match.awayTeamLogo}
                  alt={outcome}
                  className="w-[34px] h-[34px] md:w-[30px] md:h-[30px] sm:w-[28px] sm:h-[28px] xs:w-[24px] xs:h-[24px] xxs:w-[20px] xxs:h-[20px] object-contain"
                />
              )}
              <span className="text-xl md:text-lg sm:text-base xs:text-sm xxs:text-[14px]">${price.toFixed(2)}</span>
              {getOddsMovementIcon(prevVal, price)}
            </button>
          );
        })}
      </div>
      {!expanded && (
        <button
          disabled={isResolved}
          className={`w-full mt-2 flex items-center justify-center text-white text-md font-semibold space-x-2 ${
            isResolved ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={() => !isResolved && setExpanded(true)}
        >
          <PiCaretUpDownBold className="text-lg" />
          <span>More Betting Options</span>
        </button>
      )}
      {expanded && (
        <>
          <div className="p-1 w-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between md:space-x-4">
              <label className="block text-lg font-semibold">
                {tradeType === "buy" ? "Enter Buy Amount" : "Enter Sell Amount"}
              </label>
              {tradeType === "buy" ? (
                <div className="mt-2 md:mt-0 md:flex md:flex-1 md:justify-end">
                  <div className="flex flex-nowrap space-x-2 justify-start md:justify-end">
                    {[50, 100, 250, 500, 1000].map((preset) => (
                      <button
                        key={preset}
                        className="px-3 xxs:px-2 py-[0.75] rounded-full bg-blue-500 hover:bg-blue-700 text-white font-semibold"
                        onClick={() => setBetAmount(preset.toString())}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2 md:mt-0 md:flex md:flex-1 md:justify-end">
                  <p className="text-left md:text-right">
                    <strong className="text-md">Balance: </strong>
                    {isBalanceLoading ? (
                      "Checking..."
                    ) : selectedBet ? (
                      <>
                        <span className="font-semibold">{outcomeBalances[selectedBet].toFixed(2)}</span>{" "}
                        <span
                          className={
                            selectedBet === "home"
                              ? "text-blue-500 font-semibold"
                              : selectedBet === "draw"
                              ? "text-gray-400 font-semibold"
                              : "text-redmagenta font-semibold"
                          }
                        >
                          ${selectedBet?.toUpperCase()}
                        </span>
                      </>
                    ) : (
                      "N/A"
                    )}
                  </p>
                </div>
              )}
            </div>
            <input
              type="number"
              min="0"
              className="w-full p-2 mt-2 focus:outline-none focus:ring-0 rounded bg-darkblue text-white font-medium text-lg"
              placeholder={
                marketStatus !== "ready"
                  ? "Market not deployed"
                  : tradeType === "buy"
                  ? "USDC Amount"
                  : "Token Amount"
              }
              value={betAmount}
              onChange={(e) => {
                if (marketStatus !== "ready") return;
                const val = e.target.value.replace(/[^0-9.]/g, "");
                setBetAmount(val);
              }}
              disabled={marketStatus !== "ready"}
            />
            <div className="mt-3 text-md font-medium text-white">
              {tradeType === "buy" ? (
                selectedBet === null || betAmount === "" ? (
                  <p>
                    <strong>You will receive:</strong> 0.00 Tokens
                  </p>
                ) : (
                  <p>
                    {isCalculating || calculatedSharesScaled === null ? (
                      <span className="inline-flex items-center justify-start space-x-2">
                        <span>You will receive:</span>
                        <span>Calculating</span>
                        <Spinner />
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center space-x-1 whitespace-nowrap">
                          <span>
                            You will receive: {(Number(calculatedSharesScaled) / Number(SHARE_SCALE)).toFixed(2)}{" "}
                          </span>
                          <span
                            className={
                              selectedBet === "home"
                                ? "text-blue-400 font-semibold"
                                : selectedBet === "draw"
                                ? "text-gray-400 font-semibold"
                                : "text-redmagenta font-semibold"
                            }
                          >
                            ${selectedBet.toUpperCase()}
                          </span>{" "}
                          <span className="text-white">Tokens</span>
                        </span>
                      </>
                    )}
                  </p>
                )
              ) : (
                <p>
                  <strong>You will receive:</strong>{" "}
                  {selectedBet === null || betAmount === ""
                    ? " $0.00 USDC"
                    : netCost !== null
                    ? ` $${(Number(netCost) / 1e6).toFixed(2)} USDC`
                    : " Loading..."}
                </p>
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
              className={`btn w-full mt-4 py-2 h-[45px] text-lg font-semibold border-2 rounded-full text-white transition-all ${
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
      {toastMessage && (
        <div className="toast fixed bottom-[58px] left-1/2 -translate-x-1/2 sm:bottom-0 sm:right-4 sm:left-auto sm:translate-x-0">
          <div className="alert bg-greyblue border-2 border-blue-500">
            <div>
              <span className="text-blue-500 font-semibold">{toastMessage}</span>
              {toastAddress && (
                <span className="block text-xs mt-1 font-medium">
                  {toastAddress}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={isModalOpen} onClose={closeModal} className="fixed inset-0 flex items-center justify-center z-50">
        <div className="fixed inset-0 bg-black opacity-50"></div>
        <div className="bg-greyblue p-6 rounded-lg shadow-lg w-80 max-w-md sm:max-w-xs mx-auto text-center relative z-50">
          <h2 className="text-white text-2xl sm:text-xl font-semibold mb-3">Success</h2>
          <p className="text-gray-300 text-lg sm:text-base">
            {tradeType === "buy" ? "You purchased" : "You sold"}{" "}
            <span className="text-white font-bold">{modalData.shares}</span> Tokens
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
