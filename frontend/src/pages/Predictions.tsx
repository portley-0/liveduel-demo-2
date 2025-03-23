import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { TbCircleLetterDFilled } from "react-icons/tb";
import { useAccount, useWalletClient } from "wagmi";
import PredictionMarketABI from "@/abis/PredictionMarket.json" with { type: "json" };

interface UserPrediction {
  marketAddress: string;
  matchId: number;
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
}

// Helper to truncate text to a maximum of 6 letters
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

  // Helper to determine redeem button properties
  const getRedeemButtonProps = (p: UserPrediction) => {
    if (!p.isResolved) {
      return { label: "Redeem", colorClasses: "bg-gray-700", disabled: true };
    }
    if (p.hasRedeemed) {
      return { label: "Redeemed", colorClasses: "bg-green-500", disabled: true };
    }
    if (p.resolvedOutcome === p.outcome) {
      return { label: "Redeem", colorClasses: "bg-blue-600 hover:bg-blue-700", disabled: false };
    }
    return { label: "Lost", colorClasses: "bg-red-500", disabled: true };
  };

  useEffect(() => {
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
    fetchPredictions();
  }, [isConnected, address]);

  const handleRedeem = async (marketAddress: string) => {
    try {
      if (!walletClient || !address) return;
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const market = new ethers.Contract(marketAddress, PredictionMarketABI.abi, signer);
      const tx = await market.redeemPayouts();
      await tx.wait();
      alert("Redeemed successfully!");
      window.location.reload();
    } catch (error) {
      console.error("Redemption failed", error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center items-center">
        <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="text-white h-[calc(100vh-80px)] flex justify-center items-center">
        <p className="text-lg font-semibold">Log in to view predictions</p>
      </div>
    );
  }

  return (
    <div className="text-white px-4 pt-4">
      <h1 className="text-xl font-bold mb-4">My Predictions</h1>
      {predictions.length === 0 ? (
        <p>No predictions yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {predictions.map((p) => {
            const redeemProps = getRedeemButtonProps(p);
            return (
              <div
                key={`${p.marketAddress}-${p.outcome}`}
                className="bg-greyblue p-4 rounded-xl shadow-md cursor-pointer hover:bg-hovergreyblue relative"
                onClick={() => navigate(`/dashboard/markets/${p.matchId}`)}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
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
                  </div>
                  <div className="ml-2 text-lg font-semibold text-gray-300">
                    {(p.netShares / 1e6).toFixed(2)} | Cost: ${ (p.netCost / 1e6).toFixed(2) }
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="ml-2 flex-1 overflow-hidden whitespace-nowrap overflow-ellipsis">
                    {p.homeTeamLogo && (
                      <img
                        src={p.homeTeamLogo}
                        alt="Home"
                        className="h-7 w-auto object-contain inline-block"
                      />
                    )}
                    <span className="text-sm text-gray-300 inline-block ml-1">
                      <span className="block sm:hidden">
                        {truncateText(p.homeTeamName)}
                      </span>
                      <span className="hidden sm:inline">
                        {p.homeTeamName}
                      </span>
                    </span>
                    <span className="text-sm text-gray-400 inline-block mx-1">
                      vs
                    </span>
                    <span className="text-sm text-gray-300 inline-block">
                      <span className="block sm:hidden">
                        {truncateText(p.awayTeamName)}
                      </span>
                      <span className="hidden sm:inline">
                        {p.awayTeamName}
                      </span>
                    </span>
                    {p.awayTeamLogo && (
                      <img
                        src={p.awayTeamLogo}
                        alt="Away"
                        className="h-7 w-auto object-contain inline-block ml-1 mr-2"
                      />
                    )}
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <button
                      disabled={redeemProps.disabled}
                      className={`px-3 py-1 rounded-md ${redeemProps.colorClasses} text-white font-semibold text-sm ${redeemProps.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!redeemProps.disabled) {
                          handleRedeem(p.marketAddress);
                        }
                      }}
                    >
                      {redeemProps.label}
                    </button>
                  </div>
                </div>

                {p.isResolved && p.resolvedOutcome !== p.outcome && !p.hasRedeemed && (
                  <p className="text-red-400 text-sm mt-2">Incorrect prediction</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Predictions;

