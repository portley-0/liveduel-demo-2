import React, { useState, useEffect } from "react";

declare global {
  interface Window {
    ethereum?: any;
  }
}

import { ethers } from "ethers";
import { useWalletClient, useAccount } from "wagmi";
import { Dialog } from "@headlessui/react";
import LiquidityPoolABI from "@/abis/LiquidityPool.json" with { type: "json" };

const DUEL_TOKEN_ADDRESS = "0x6ac54f1D7Fa5B8627A3905A30E6C2528Bf27E6Ee";
const LIQUIDITY_POOL_ADDRESS = "0x625D7fae1a2099B9429845dA2dd4a39b30194a91";
const AVALANCHE_FUJI_RPC = "https://avalanche-fuji.public.blastapi.io";

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const formatLargeNumber = (num: number): string => {
  if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + "M";
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + "K";
  }
  return num.toFixed(2);
};

const Staking: React.FC = () => {
  const { data: walletClient } = useWalletClient();
  const { address, isConnected } = useAccount();

  const [userAddress, setUserAddress] = useState<string>("");
  const [stakedBalance, setStakedBalance] = useState<number>(0);
  const [pendingRewards, setPendingRewards] = useState<number>(0);
  const [usdcReserve, setUsdcReserve] = useState<number>(0);
  const [duelReserve, setDuelReserve] = useState<number>(0);
  const [duelPrice, setDuelPrice] = useState<number>(0);
  const [inputAmount, setInputAmount] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"Stake" | "Unstake">("Stake");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Modal state for stake/unstake success
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMessage, setModalMessage] = useState<string>("");

  const publicProvider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);

  // Helper function to get signer with logging
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

  // Ensure the user has approved the LiquidityPool to spend their DUEL tokens.
  const ensureApproval = async (amount: ethers.BigNumberish) => {
    const signer = await getSigner();
    if (!signer || !address) return;
    const duelTokenContract = new ethers.Contract(DUEL_TOKEN_ADDRESS, ERC20_ABI, signer);
    const currentAllowance = await duelTokenContract.allowance(address, LIQUIDITY_POOL_ADDRESS);
    console.log("Current allowance:", currentAllowance.toString());
    if (ethers.getBigInt(currentAllowance) < ethers.getBigInt(amount)) {
      console.log("Insufficient allowance, approving now...");
      const tx = await duelTokenContract.approve(LIQUIDITY_POOL_ADDRESS, amount);
      await tx.wait();
      console.log("Approval successful.");
    } else {
      console.log("Sufficient allowance already exists.");
    }
  };

  const fetchData = async () => {
    try {
      if (!address) return;
  
      setUserAddress(address);
      const contract = new ethers.Contract(
        LIQUIDITY_POOL_ADDRESS,
        LiquidityPoolABI.abi,
        publicProvider
      );
  
      const staked = await contract.stakedBalances(address);
      setStakedBalance(parseFloat(ethers.formatUnits(staked, 18)));
  
      const rewards = await contract.pendingRewards(address);
      setPendingRewards(parseFloat(ethers.formatUnits(rewards, 6)));
  
    } catch (error) {
      console.error("Error fetching staking data", error);
    }
  };
  
  const fetchReserves = async () => {
    try {
      const contract = new ethers.Contract(
        LIQUIDITY_POOL_ADDRESS,
        LiquidityPoolABI.abi,
        publicProvider
      );
  
      const reserves = await contract.getReserves();
      const usdcVal = parseFloat(ethers.formatUnits(reserves[0], 6));
      const duelVal = parseFloat(ethers.formatUnits(reserves[1], 18));
      setUsdcReserve(usdcVal);
      setDuelReserve(duelVal);
      if (duelVal > 0) {
        setDuelPrice(usdcVal / duelVal);
      }
    } catch (error) {
      console.error("Error fetching reserves", error);
    }
  };
  
  useEffect(() => {
    fetchReserves(); 
  }, []);
  
  useEffect(() => {
    if (isConnected && address) {
      fetchData();
    }
  }, [isConnected, address]);
  
  useEffect(() => {
    console.log("walletClient:", walletClient);
    console.log("Connected address:", address);
  }, [walletClient, address]);

  const claimRewards = async () => {
    const signer = await getSigner();
    if (!signer) return;
    try {
      const contract = new ethers.Contract(
        LIQUIDITY_POOL_ADDRESS,
        LiquidityPoolABI.abi,
        signer
      );
      const tx = await contract.claimRewards();
      await tx.wait();
      fetchData();
      setModalMessage("Claim successful!");
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error claiming rewards", error);
    }
  };

  const stakeTokens = async () => {
    const signer = await getSigner();
    if (!signer) return;
    try {
      setIsProcessing(true);
      const amount = ethers.parseUnits(inputAmount, 18);
      console.log("Staking amount (parsed):", amount.toString());
      // Ensure approval is in place before staking
      await ensureApproval(amount);
  
      const contract = new ethers.Contract(
        LIQUIDITY_POOL_ADDRESS,
        LiquidityPoolABI.abi,
        signer
      );
      const tx = await contract.stake(amount);
      await tx.wait();
      setInputAmount("");
      fetchData();
  
      const message =
        pendingRewards > 0
          ? "Stake successful!\nRewards Claimed"
          : "Stake successful!";
      setModalMessage(message);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error staking tokens", error);
    } finally {
      setIsProcessing(false);
    }
  };
  

  const unstakeTokens = async () => {
    const signer = await getSigner();
    if (!signer) return;
    try {
      setIsProcessing(true);
      const amount = ethers.parseUnits(inputAmount, 18);
      const contract = new ethers.Contract(
        LIQUIDITY_POOL_ADDRESS,
        LiquidityPoolABI.abi,
        signer
      );
      const tx = await contract.withdrawStake(amount);
      await tx.wait();
      setInputAmount("");
      fetchData();
      setModalMessage("Unstake successful!");
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error unstaking tokens", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 lg:-mt-4 sm:mt-4 sx:mt-4">
      <div className="space-y-0">
        <div className="bg-cyan-500 text-white rounded-xl p-4 relative">
          <div className="flex flex-col text-sm md:text-lg font-semibold">
            <div className="flex justify-between items-center whitespace-nowrap">
              <div>
                {formatLargeNumber(duelReserve)} $DUEL | {formatLargeNumber(usdcReserve)} USDC
              </div>
              <div className="text-right">Stake Balance</div>
            </div>
            <div className="flex justify-between items-center whitespace-nowrap mt-[2px]">
              <div>1 $DUEL = ${duelPrice.toFixed(2)} USDC</div>
              <div className="text-right">
                {stakedBalance > 0 ? formatLargeNumber(stakedBalance) : "0.00"} $DUEL
              </div>
            </div>
          </div>

          <hr className="border-t-2 border-white my-4" />
          <div className="flex justify-between items-center text-sm md:text-lg font-semibold">
            <div className="text-left hidden md:block">
              <span>2% per TX added to rewards</span>
            </div>
            <div className="text-center">
              <div>Claimable Rewards:</div>
              <div>{pendingRewards.toFixed(2)} USDC</div>
            </div>
            <div className="text-right">
              <button
                className="btn border-2 border-white text-white rounded-full px-3 py-1 text-sm md:text-lg"
                onClick={claimRewards}
              >
                Claim
              </button>
            </div>
          </div>
        </div>

        <div className="bg-darkblue text-white rounded-xl shadow-md w-full">
          <div className="flex border-b border-gray-600">
            <button
              onClick={() => setActiveTab("Stake")}
              className={`flex-1 text-center py-3 text-lg font-semibold transition-all ${
                activeTab === "Stake"
                  ? "text-redmagenta border-b-2 border-redmagenta"
                  : "text-white hover:text-gray-300"
              }`}
            >
              Stake
            </button>
            <button
              onClick={() => setActiveTab("Unstake")}
              className={`flex-1 text-center py-3 text-lg font-semibold transition-all ${
                activeTab === "Unstake"
                  ? "text-redmagenta border-b-2 border-redmagenta"
                  : "text-white hover:text-gray-300"
              }`}
            >
              Unstake
            </button>
          </div>
          <div className="bg-greyblue p-4 mt-4 rounded-xl text-lg font-semibold">
            <div className="mb-3">
              <label className="block mb-2">$DUEL Amount</label>
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0"
                className="bg-darkblue p-3 rounded w-full text-white text-lg"
              />
            </div>
            <button
              onClick={activeTab === "Stake" ? stakeTokens : unstakeTokens}
              disabled={isProcessing}
              className={`bg-darkblue border-2 border-gray-300 btn rounded-full w-full font-semibold text-lg ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isProcessing ? "Processing..." : (activeTab === "Stake" ? "Stake" : "Unstake")}
            </button>
          </div>
        </div>
      </div>

      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="fixed inset-0 flex items-center justify-center z-50">
        <div className="fixed inset-0 bg-black opacity-50"></div>
        <div className="bg-greyblue p-6 rounded-lg shadow-lg w-auto max-w-md sm:max-w-xs mx-4 sm:mx-auto text-center relative z-50">
          <h2 className="text-white text-2xl sm:text-xl font-semibold mb-3">Success</h2>
          <p className="text-gray-300 text-lg sm:text-base" style={{ whiteSpace: "pre-line" }}>{modalMessage}</p>
          <button
            className="mt-4 bg-greyblue border-2 border-white hover:border-blue-500 text-white font-semibold px-6 py-2 sm:px-4 sm:py-1.5 rounded-full transition"
            onClick={() => setIsModalOpen(false)}
          >
            Continue
          </button>
        </div>
      </Dialog>
    </div>
  );
};

export default Staking;
