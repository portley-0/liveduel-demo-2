import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { TbCircleLetterDFilled } from "react-icons/tb";
import { useAccount, useWalletClient } from "wagmi";
import { Dialog } from "@headlessui/react";
import PredictionMarketABI from "@/abis/PredictionMarket.json" with { type: "json" };
import ConditionalTokensABI from "@/abis/ConditionalTokens.json" with { type: "json" };

const CONDITIONAL_TOKENS_ADDRESS = "0x0f583449d6AF8aa0B038123aB686B8c48bdbf914";
const CONDITIONAL_TOKENS_ABI = ConditionalTokensABI.abi;

interface UserPrediction {
  marketAddress: string;
  matchId?: number;
  tournamentId?: number;
  timestamp?: number | null;
  outcome: number;
  netShares: number;
  netCost: number;
  isResolved: boolean;
  resolvedOutcome?: number | null;
  hasRedeemed: boolean;
  homeTeamName?: string;
  homeTeamLogo?: string;
  awayTeamName?: string;
  awayTeamLogo?: string;
  selectedTeamName?: string;
  selectedTeamLogo?: string;
  leagueId?: number;
  leagueName?: string;
  leagueLogo?: string;
}

const truncateText = (text: string | undefined, maxLength: number = 6) => {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
};

const Predictions: React.FC = () => {
  const [predictions, setPredictions] = useState<UserPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const navigate = useNavigate();

  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [redeemModalData, setRedeemModalData] = useState({ shares: "", cost: 0 });
  const closeRedeemModal = () => {
    setIsRedeemModalOpen(false);
    fetchPredictions();
  };

  const [redeemingMarketAddress, setRedeemingMarketAddress] = useState<string | null>(null);

  const getRedeemButtonProps = (p: UserPrediction) => {
    if (!p.isResolved) {
      return { label: "Pending", colorClasses: "bg-gray-700", disabled: true };
    }
    if (p.resolvedOutcome === p.outcome) {
      return p.hasRedeemed
        ? { label: "Redeemed", colorClasses: "bg-green-500", disabled: true }
        : { label: "Redeem", colorClasses: "bg-blue-600 hover:bg-blue-700", disabled: false };
    }
    return { label: "Lost", colorClasses: "bg-red-500", disabled: true };
  };

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      if (!isConnected || !address) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/predictions/${address}`);
      const json = await res.json();
      if (json.success) {
        setPredictions(json.data);
      }
    } catch (error) {
      console.error("Failed to fetch predictions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, [isConnected, address]);

  const handleRedeem = async (prediction: UserPrediction) => {
    try {
      if (!walletClient || !address) return;
      setRedeemingMarketAddress(prediction.marketAddress);
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      const conditionalTokens = new ethers.Contract(
        CONDITIONAL_TOKENS_ADDRESS,
        CONDITIONAL_TOKENS_ABI,
        signer
      );
      const approvalTx = await conditionalTokens.setApprovalForAll(prediction.marketAddress, true);
      await approvalTx.wait();

      const market = new ethers.Contract(prediction.marketAddress, PredictionMarketABI.abi, signer);
      const tx = await market.redeemPayouts();
      await tx.wait();

      const redeemedAmount = (prediction.netShares / 1e6).toFixed(2);
      setRedeemModalData({
        shares: redeemedAmount,
        cost: prediction.netCost / 1e6,
      });
      setIsRedeemModalOpen(true);
    } catch (error) {
      console.error("Redemption failed", error);
    } finally {
      setRedeemingMarketAddress(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 min-h-screen flex justify-center items-center">
        <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen flex justify-center items-center text-white">
        <p className="text-lg font-semibold transform -translate-y-16">Log in to view predictions</p>
      </div>
    );
  }

  return (
    <>
      <div className="text-white px-4 pt-4 pb-20">
        <h1 className="text-xl font-bold mb-4">My Predictions</h1>
        {predictions.length === 0 ? (
          <p>No predictions yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {predictions.map((p) => {
              const redeemProps = getRedeemButtonProps(p);
              const isRedeemable = redeemProps.label === "Redeem";
              const isRedeeming = isRedeemable && redeemingMarketAddress === p.marketAddress;
              const finalButtonProps = isRedeeming
                ? { label: "Redeeming", colorClasses: redeemProps.colorClasses, disabled: true }
                : redeemProps;
              const isTournament = !!p.tournamentId;
              return (
                <div
                  key={`${p.marketAddress}-${p.outcome}`}
                  className="bg-greyblue p-4 rounded-xl shadow-md cursor-pointer hover:bg-hovergreyblue relative"
                  onClick={() =>
                    navigate(
                      isTournament
                        ? `/dashboard/tournaments/${p.tournamentId}`
                        : `/dashboard/matches/${p.matchId}`
                    )
                  }
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {isTournament ? (
                        p.selectedTeamLogo ? (
                          <img
                            src={p.selectedTeamLogo}
                            alt="Selected Team"
                            className="h-10 w-10 object-contain"
                          />
                        ) : (
                          <TbCircleLetterDFilled className="text-gray-300 h-10 w-10" />
                        )
                      ) : (
                        <>
                          {p.outcome === 0 && p.homeTeamLogo && (
                            <img
                              src={p.homeTeamLogo}
                              alt="Home"
                              className="h-10 w-10 object-contain"
                            />
                          )}
                          {p.outcome === 1 && (
                            <TbCircleLetterDFilled className="text-gray-300 h-10 w-10" />
                          )}
                          {p.outcome === 2 && p.awayTeamLogo && (
                            <img
                              src={p.awayTeamLogo}
                              alt="Away"
                              className="h-10 w-10 object-contain"
                            />
                          )}
                        </>
                      )}
                    </div>
                    <div className="ml-2 text-lg font-semibold text-gray-300">
                      {(p.netShares / 1e6).toFixed(2)} | Cost: ${(p.netCost / 1e6).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="ml-2 flex-1 overflow-hidden whitespace-nowrap overflow-ellipsis">
                      {isTournament ? (
                        <div className="flex items-center">
                          {p.leagueLogo && (
                            <div className="bg-white aspect-square flex justify-center items-center w-[32px] h-[32px]">
                              <img
                                src={p.leagueLogo}
                                alt="League"
                                className="h-7 w-auto object-contain"
                              />
                            </div>
                          )}
                          <span className="text-sm text-gray-300 ml-1">
                            <span className="block sm:hidden">{p.leagueName}</span>
                            <span className="hidden sm:inline">{p.leagueName}</span>
                          </span>
                          {p.selectedTeamName && (
                            <span className="text-sm text-gray-300 ml-1">
                              <span className="block sm:hidden">{p.selectedTeamName}</span>
                              <span className="hidden sm:inline">{p.selectedTeamName}</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          {p.homeTeamLogo && (
                            <img
                              src={p.homeTeamLogo}
                              alt="Home"
                              className="h-7 w-auto object-contain inline-block"
                            />
                          )}
                          <span className="text-sm text-gray-300 inline-block ml-1">
                            <span className="block sm:hidden">{truncateText(p.homeTeamName)}</span>
                            <span className="hidden sm:inline">{p.homeTeamName}</span>
                          </span>
                          <span className="text-sm text-gray-400 inline-block mx-1">vs</span>
                          <span className="text-sm text-gray-300 inline-block">
                            <span className="block sm:hidden">{truncateText(p.awayTeamName)}</span>
                            <span className="hidden sm:inline">{p.awayTeamName}</span>
                          </span>
                          {p.awayTeamLogo && (
                            <img
                              src={p.awayTeamLogo}
                              alt="Away"
                              className="h-7 w-auto object-contain inline-block ml-1 mr-2"
                            />
                          )}
                        </>
                      )}
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <button
                        disabled={finalButtonProps.disabled}
                        className={`w-24 text-center px-3 py-1 rounded-md ${finalButtonProps.colorClasses} text-white font-semibold text-sm ${
                          finalButtonProps.disabled ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!finalButtonProps.disabled) {
                            handleRedeem(p);
                          }
                        }}
                      >
                        {finalButtonProps.label}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={isRedeemModalOpen}
        onClose={closeRedeemModal}
        className="fixed inset-0 flex items-center justify-center z-50"
      >
        <div className="fixed inset-0 bg-black opacity-50"></div>
        <div className="bg-greyblue p-6 rounded-lg shadow-lg w-auto max-w-md sm:max-w-xs mx-4 sm:mx-auto text-center relative z-50">
          <h2 className="text-white text-2xl sm:text-xl font-semibold mb-3">Success</h2>
          <p className="text-gray-300 text-lg sm:text-base">
            You redeemed <span className="text-white font-bold">{redeemModalData.shares}</span> outcome tokens
          </p>
          <p className="text-gray-300 text-lg sm:text-base">
            for a payout of <span className="text-white font-bold">${redeemModalData.shares}</span> USDC
          </p>
          <button
            className="mt-4 bg-greyblue border-2 border-white hover:border-blue-500 text-white font-semibold px-6 py-2 sm:px-4 sm:py-1.5 rounded-full transition"
            onClick={closeRedeemModal}
          >
            Continue
          </button>
        </div>
      </Dialog>
    </>
  );
};

export default Predictions;