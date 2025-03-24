import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWalletClient } from "wagmi";
import LiquidityPoolABI from "@/abis/LiquidityPool.json" with { type: "json" };

const LIQUIDITY_POOL_ADDRESS = "0x625D7fae1a2099B9429845dA2dd4a39b30194a91";
const AVALANCHE_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

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

  const [userAddress, setUserAddress] = useState<string>("");
  const [stakedBalance, setStakedBalance] = useState<number>(0);
  const [pendingRewards, setPendingRewards] = useState<number>(0);
  const [usdcReserve, setUsdcReserve] = useState<number>(0);
  const [duelReserve, setDuelReserve] = useState<number>(0);
  const [duelPrice, setDuelPrice] = useState<number>(0);
  const [inputAmount, setInputAmount] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"Stake" | "Unstake">("Stake");
  const [loading, setLoading] = useState<boolean>(false);

  const publicProvider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);

  const fetchData = async () => {
    try {
      let address = "";
      if (walletClient) {
        const provider = new ethers.BrowserProvider(walletClient as any);
        const signer = await provider.getSigner();
        address = await signer.getAddress();
        setUserAddress(address);
      }
      const contract = new ethers.Contract(
        LIQUIDITY_POOL_ADDRESS,
        LiquidityPoolABI.abi,
        publicProvider
      );

      if (address) {
        const staked = await contract.stakedBalances(address);
        setStakedBalance(parseFloat(ethers.formatUnits(staked, 18)));

        const rewards = await contract.pendingRewards(address);
        setPendingRewards(parseFloat(ethers.formatUnits(rewards, 6)));
      }
      const reserves = await contract.getReserves();
      const usdcVal = parseFloat(ethers.formatUnits(reserves[0], 6));
      const duelVal = parseFloat(ethers.formatUnits(reserves[1], 18));
      setUsdcReserve(usdcVal);
      setDuelReserve(duelVal);
      if (duelVal > 0) {
        setDuelPrice(usdcVal / duelVal);
      }
    } catch (error) {
      console.error("Error fetching staking data", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [walletClient]);


  const claimRewards = async () => {
    if (!walletClient) return;
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        LIQUIDITY_POOL_ADDRESS,
        LiquidityPoolABI.abi,
        signer
      );
      const tx = await contract.claimRewards();
      await tx.wait();
      fetchData();
    } catch (error) {
      console.error("Error claiming rewards", error);
    }
  };

  const stakeTokens = async () => {
    if (!walletClient) return;
    try {
      setLoading(true);
      const amount = ethers.parseUnits(inputAmount, 18);
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        LIQUIDITY_POOL_ADDRESS,
        LiquidityPoolABI.abi,
        signer
      );
      const tx = await contract.stake(amount);
      await tx.wait();
      setInputAmount("");
      fetchData();
    } catch (error) {
      console.error("Error staking tokens", error);
    } finally {
      setLoading(false);
    }
  };

  const unstakeTokens = async () => {
    if (!walletClient) return;
    try {
      setLoading(true);
      const amount = ethers.parseUnits(inputAmount, 18);
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        LIQUIDITY_POOL_ADDRESS,
        LiquidityPoolABI.abi,
        signer
      );
      const tx = await contract.withdrawStake(amount);
      await tx.wait();
      setInputAmount("");
      fetchData();
    } catch (error) {
      console.error("Error unstaking tokens", error);
    } finally {
      setLoading(false);
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
            <div className="text-right">
              Staked Balance
            </div>
          </div>
          <div className="flex justify-between items-center whitespace-nowrap mt-[2px]">
            <div>
              1 $DUEL = ${duelPrice.toFixed(2)} USDC
            </div>
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
              className="border-2 border-white rounded-full px-3 py-1 text-sm md:text-lg"
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
          <div className="bg-greyblue p-4 mt-4 rounded-lg text-lg font-semibold">
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
              className="bg-darkblue border-2 border-bg-grey-300 btn rounded-full w-full font-semibold text-lg"
              disabled={loading}
            >
              {activeTab === "Stake" ? "Stake" : "Unstake"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Staking;
