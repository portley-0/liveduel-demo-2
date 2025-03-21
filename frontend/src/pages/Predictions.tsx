import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { TbCircleLetterDFilled } from "react-icons/tb";
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

const Predictions: React.FC = () => {
  const [predictions, setPredictions] = useState<UserPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const ethereum = (window as any).ethereum;
        if (!ethereum) {
          console.error("No wallet found");
          setWalletAddress(null);
          return;
        }

        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWalletAddress(address);

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
  }, []);

  const handleRedeem = async (marketAddress: string) => {
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) return;
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const market = new ethers.Contract(marketAddress, PredictionMarketABI.abi, signer);
      const tx = await market.redeem();
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

  if (!walletAddress) {
    return (
      <div className="text-white text-center mt-10">
        <p className="text-lg font-semibold">Log in to view predictions</p>
      </div>
    );
  }

  return (
    <div className="text-white px-4 pt-4 h-[calc(100vh-80px)] overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">My Predictions</h1>
      {predictions.length === 0 ? (
        <p>No predictions yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {predictions.map((p) => (
            <div
              key={`${p.marketAddress}-${p.outcome}`}
              className="bg-greyblue p-4 rounded-xl shadow-md cursor-pointer hover:bg-hovergreyblue"
              onClick={() => navigate(`/dashboard/markets/${p.matchId}`)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {p.outcome === 0 && p.homeTeamLogo && (
                    <img src={p.homeTeamLogo} alt="Home" className="h-10 w-10 object-contain" />
                  )}
                  {p.outcome === 1 && (
                    <TbCircleLetterDFilled className="text-gray-300 text-[32px]" />
                  )}
                  {p.outcome === 2 && p.awayTeamLogo && (
                    <img src={p.awayTeamLogo} alt="Away" className="h-10 w-10 object-contain" />
                  )}
                  <span className="text-lg font-semibold text-white">
                    {p.outcome === 0
                      ? p.homeTeamName
                      : p.outcome === 2
                      ? p.awayTeamName
                      : "Draw"}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {p.homeTeamLogo && (
                    <img src={p.homeTeamLogo} alt="Home" className="h-7 w-auto object-contain" />
                  )}
                  <span className="text-sm text-gray-300">{p.homeTeamName}</span>
                  <span className="text-sm text-gray-400 mx-1">vs</span>
                  <span className="text-sm text-gray-300">{p.awayTeamName}</span>
                  {p.awayTeamLogo && (
                    <img src={p.awayTeamLogo} alt="Away" className="h-7 w-auto object-contain" />
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center text-sm text-gray-300 mt-2">
                <span>
                  Shares: {(p.netShares / 1e6).toFixed(2)} | Cost: ${(p.netCost / 1e6).toFixed(2)}
                </span>

                {p.isResolved && !p.hasRedeemed && p.resolvedOutcome === p.outcome && (
                  <button
                    className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRedeem(p.marketAddress);
                    }}
                  >
                    Redeem
                  </button>
                )}
              </div>

              {p.isResolved && p.resolvedOutcome !== p.outcome && (
                <p className="text-red-400 text-sm mt-2">Incorrect prediction</p>
              )}

              {p.isResolved && p.hasRedeemed && (
                <p className="text-green-400 text-sm mt-2">Redeemed</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Predictions;
