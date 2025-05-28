import React, { useState, useEffect, useRef } from "react";
import { Dialog } from "@headlessui/react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { TournamentData, TeamStanding } from "@/types/TournamentData.ts";
import { useTournamentMarketFactory } from "@/hooks/useTournamentMarketFactory.ts";
import { useTournamentNetCost } from "@/hooks/useTournamentNetCost.ts";
import { BsArrowDownUp } from "react-icons/bs";
import { PiCaretUpDownBold } from "react-icons/pi";
import { GoArrowUpRight, GoArrowDownRight } from "react-icons/go";
import TournamentMarketABI from "@/abis/TournamentMarket.json" with { type: "json" };
import ConditionalTokensABI from "@/abis/ConditionalTokens.json" with { type: "json" };
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

const DEFAULT_PROB = 0.25;
const USDC_ADDRESS = "0x3dD0616eac0c614250280B22B171239365920a10";
const CONDITIONAL_TOKENS_ADDRESS = "0x0f583449d6AF8aa0B038123aB686B8c48bdbf914";
const USDC_ABI = MockUSDCABI.abi;
const CONDITIONAL_TOKENS_ABI = ConditionalTokensABI.abi;
const AVALANCHE_FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
const SHARE_SCALE = 1000000n;

const TEAM_COLORS = [
  "rgba(0, 123, 255, 1)", // Blue
  "rgba(255, 193, 7, 1)", // Yellow
  "rgb(169, 169, 169)", // Gray
  "rgb(225, 29, 72)", // Red
];

const TournamentBetting: React.FC<{ tournament: TournamentData }> = ({ tournament }) => {
  const [selectedBet, setSelectedBet] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState<string>("");
  const [expanded, setExpanded] = useState(true);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const { data: marketAddress, isLoading, refetch } = useTournamentMarketFactory(tournament.tournamentId);
  const [marketStatus, setMarketStatus] = useState<"loading" | "not_deployed" | "ready">("loading");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isTxPending, setIsTxPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();
  const [refreshKey, setRefreshKey] = useState(0);
  const [teamPrices, setTeamPrices] = useState<Record<number, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ shares: 0, cost: 0 });
  const [outcomeBalance, setOutcomeBalance] = useState<string | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [conditionId, setConditionId] = useState<string | null>(null);
  const [outcomeTokenIds, setOutcomeTokenIds] = useState<{ [key: number]: string }>({});
  const [calculatedSharesScaled, setCalculatedSharesScaled] = useState<bigint | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calcTokenRef = useRef(0);
  const isResolved = !!tournament.resolvedAt;
  const closeModal = () => setIsModalOpen(false);

  // Use teamIds from contract, fallback to oddsHistory or latestOdds
  const teamIdsInOdds = tournament.teamIds?.length
    ? tournament.teamIds
    : tournament.oddsHistory?.teamOdds
    ? Object.keys(tournament.oddsHistory.teamOdds).map(Number)
    : tournament.latestOdds
    ? Object.keys(tournament.latestOdds).map(Number)
    : [];
  const allTeams = Array.isArray(tournament.standings?.league.standings)
    ? (tournament.standings?.league.standings.flat() as TeamStanding[])
    : (tournament.standings?.league.standings as TeamStanding[] | undefined) || [];
  const teams = allTeams.filter((team) => teamIdsInOdds.includes(team.team.id));
  const sortedTeams = teamIdsInOdds
    .map((teamId) => teams.find((team) => team.team.id === teamId))
    .filter((team): team is TeamStanding => !!team);
  const teamIndexMap = teamIdsInOdds.reduce((acc, teamId, index) => {
    acc[teamId] = index;
    return acc;
  }, {} as Record<number, number>);

  useEffect(() => {
    console.log("Team Assignments:", {
      teamIdsInOdds,
      teamNames: sortedTeams.map((team) => ({
        id: team.team.id,
        name: team.team.name,
        index: teamIndexMap[team.team.id],
      })),
      latestOdds: tournament.latestOdds,
      contractTeamIds: tournament.teamIds,
    });
  }, [sortedTeams, teamIndexMap, tournament.latestOdds, tournament.teamIds]);

  const fetchConditionId = async (): Promise<void> => {
    if (!walletClient || !marketAddress) return;
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const tournamentMarket = new ethers.Contract(marketAddress, TournamentMarketABI.abi, signer);
      const fetchedId = await tournamentMarket.getConditionId();
      if (fetchedId !== conditionId) {
        setConditionId(fetchedId);
        const conditionalTokensContract = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, CONDITIONAL_TOKENS_ABI, signer);
        const tokens: { [key: number]: string } = {};
        for (let i = 0; i < teamIdsInOdds.length; i++) {
          const indexSet = 1 << i;
          const collectionId = await conditionalTokensContract.getCollectionId(ethers.ZeroHash, fetchedId, indexSet);
          const positionId = await conditionalTokensContract.getPositionId(USDC_ADDRESS, collectionId);
          tokens[i] = positionId;
        }
        console.log("Outcome Token IDs:", { teamIdsInOdds, outcomeTokenIds: tokens });
        setOutcomeTokenIds(tokens);
      }
    } catch (error) {
      console.error("Error fetching conditionId or outcome token IDs:", error);
    }
  };

  useEffect(() => {
    fetchConditionId();
  }, [walletClient, marketAddress]);

  useEffect(() => {
    if (tradeType !== "sell" || !marketAddress || selectedBet === null || !conditionId) return;
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
    console.log("Market Fetch Debug:", {
      tournamentId: tournament.tournamentId,
      isLoading,
      marketAddress,
    });
    if (isLoading) {
      setMarketStatus("loading");
    } else if (!marketAddress) {
      setMarketStatus("not_deployed");
    } else {
      setMarketStatus("ready");
    }
  }, [isLoading, marketAddress]);

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [tournament.latestOdds]);

  const isValidBet = selectedBet !== null && betAmount !== "";
  const numericBetAmount = parseFloat(betAmount || "0");
  const betAmountBigInt = isValidBet ? BigInt(Math.round(numericBetAmount * 1_000_000)) : null;

  const { data: netCost, isLoading: isFetchingNetCost } = useTournamentNetCost(
    marketAddress,
    isValidBet && selectedBet !== null ? teamIndexMap[selectedBet] : null,
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
      provider = new ethers.BrowserProvider(anyClient.provider);
    } else if (typeof window !== "undefined" && window.ethereum) {
      provider = new ethers.BrowserProvider(window.ethereum);
    } else {
      provider = new ethers.BrowserProvider(walletClient as any);
    }
    const signer = await provider.getSigner();
    return signer;
  };

  const getNetCostForShares = async (shares: bigint): Promise<bigint> => {
    if (!marketAddress || selectedBet === null)
      throw new Error("Missing prerequisites for net cost calculation");
    const provider = publicProvider;
    const tournamentMarket = new ethers.Contract(marketAddress, TournamentMarketABI.abi, provider);
    const outcomeIndex = teamIndexMap[selectedBet];
    const netCost: bigint = await tournamentMarket.getNetCost(outcomeIndex, shares);
    return netCost;
  };

  async function findSharesForCost(
    targetCost: bigint,
    tolerance: bigint = 1n,
    maxIterations: number = 50
  ): Promise<bigint> {
    let initialGuess = BigInt(Math.round(numericBetAmount * teamIdsInOdds.length)) * SHARE_SCALE;
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
      const contract = new ethers.Contract(contractAddress, TournamentMarketABI.abi, signer);
      const gasEstimate = await contract[functionName].estimateGas(...args);
      const gasLimit = (gasEstimate * BigInt(12)) / BigInt(10);
      const tx = await contract[functionName](...args, { gasLimit, ...options });
      setTxHash(tx.hash);
      const receipt = await tx.wait(1);
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
      openConnectModal?.();
      return;
    }
    if (!marketAddress || selectedBet === null || calculatedSharesScaled === null) return;
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const approvalAmount = BigInt(Math.round(parseFloat(betAmount) * 1_000_000));
      const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
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
      const receipt = await sendTransaction(
        marketAddress,
        "buySharesWithPermit",
        [
          teamIndexMap[selectedBet],
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
      openConnectModal?.();
      return;
    }
    if (!marketAddress || !isValidBet) return;
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const conditionalTokensContract = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, CONDITIONAL_TOKENS_ABI, signer);
      const isApproved = await conditionalTokensContract.isApprovedForAll(userAddress, marketAddress);
      if (!isApproved) {
        const approveTx = await conditionalTokensContract.setApprovalForAll(marketAddress, true);
        await approveTx.wait();
      }
      const receipt = await sendTransaction(
        marketAddress,
        "sellShares",
        [teamIndexMap[selectedBet!], betAmountBigInt],
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

  const fetchOutcomeBalance = async () => {
    if (!walletClient || !marketAddress || selectedBet === null || !conditionId) return;
    setIsBalanceLoading(true);
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const conditionalTokensContract = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, CONDITIONAL_TOKENS_ABI, signer);
      const outcomeIndex = teamIndexMap[selectedBet];
      const tokenId = outcomeTokenIds[outcomeIndex];
      const balance = await conditionalTokensContract.balanceOf(userAddress, tokenId);
      setOutcomeBalance((Number(balance) / Number(SHARE_SCALE)).toFixed(2));
    } catch (error) {
      console.error("Failed to fetch outcome balance:", error);
      setOutcomeBalance(null);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      refetch();
    }
  }, [isSuccess, refetch]);

  useEffect(() => {
    const newPrices: Record<number, number> = {};
    teamIdsInOdds.forEach((teamId) => {
      newPrices[teamId] = tournament.latestOdds?.[teamId] ?? DEFAULT_PROB;
    });
    setTeamPrices(newPrices);
  }, [tournament.latestOdds]);

  const handleSelectBet = (teamId: number) => {
    setSelectedBet(teamId);
  };

  const prevOdds = (() => {
    const histCount = tournament.oddsHistory?.timestamps?.length ?? 0;
    if (histCount >= 2) {
      const prev: Record<number, number> = {};
      teamIdsInOdds.forEach((teamId) => {
        prev[teamId] =
          tournament.oddsHistory!.teamOdds[teamId]?.[histCount - 2] !== undefined
            ? 1 / tournament.oddsHistory!.teamOdds[teamId][histCount - 2]
            : tournament.latestOdds?.[teamId] ?? DEFAULT_PROB;
      });
      return prev;
    }
    return teamIdsInOdds.reduce((acc, teamId) => {
      acc[teamId] = DEFAULT_PROB;
      return acc;
    }, {} as Record<number, number>);
  })();

  function getOddsMovementIcon(prev: number, current: number) {
    const NEUTRAL_PROB = DEFAULT_PROB;
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
        <h2 className="text-xl font-bold pr-2">Tournament Winner</h2>
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
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-1 mb-1">
        {sortedTeams.map((team) => {
          const price = teamPrices[team.team.id] ?? DEFAULT_PROB;
          const isSelected = selectedBet === team.team.id;
          const prevVal = prevOdds[team.team.id];
          const borderColor =
            isSelected && tradeType === "buy"
              ? "border-blue-500"
              : isSelected && tradeType === "sell"
              ? "border-red-600"
              : "border-gray-400";
          return (
            <button
              key={`bet-button-${team.team.id}-${refreshKey}`}
              disabled={isResolved}
              className={`border-2 shadow-md ${borderColor} text-white font-semibold 
                w-full h-[45px] flex items-center justify-center space-x-1.5 sm:space-x-3 lg:space-x-1.5 transition-all rounded-full focus:outline-none focus:ring-0 ${
                  isResolved ? "opacity-50 cursor-not-allowed" : isSelected ? "bg-hovergreyblue" : "bg-greyblue hover:bg-hovergreyblue"
                }`}
              onClick={() => !isResolved && handleSelectBet(team.team.id)}
            >
              <img
                src={team.team.logo}
                alt={team.team.name}
                className="w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] object-contain"
              />
              <span className="text-lg sm:text-base">${price.toFixed(2)}</span>
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
                        className="px-3 sm:px-2 py-[0.75] rounded-full bg-blue-500 hover:bg-blue-700 text-white font-semibold"
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
                    ) : outcomeBalance !== null ? (
                      <>
                        <span className="font-semibold">{outcomeBalance}</span>{" "}
                        <span
                          style={{
                            color:
                              selectedBet !== null
                                ? TEAM_COLORS[teamIndexMap[selectedBet] % TEAM_COLORS.length]
                                : "text-gray-500",
                            fontWeight: "600",
                          }}
                        >
                          ${sortedTeams
                            .find((t) => t.team.id === selectedBet)
                            ?.team.name.split(" ")[0]
                            .toUpperCase() || "TEAM"}
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
                  ? "Market not found for this tournament"
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
                          <span className="text-blue-400 font-semibold">
                            ${sortedTeams.find((t) => t.team.id === selectedBet)?.team.name.toUpperCase() || "TEAM"}
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
                    ? ` $${(Number(netCost) / Number(SHARE_SCALE)).toFixed(2)} USDC`
                    : " Loading..."}
                </p>
              )}
              {marketStatus === "loading" && (
                <p className="text-white font-semibold mt-2">🔄 Checking market status...</p>
              )}
              {marketStatus === "not_deployed" && (
                <p className="text-white font-semibold mt-2">
                  ⚠️ Market not found for this tournament
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

export default TournamentBetting;