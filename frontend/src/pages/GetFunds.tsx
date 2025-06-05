import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";

const FAUCET_ADDRESS = "0x127D700E6B5BE749d604B10F065908b431Eb30a3";
const AVALANCHE_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const SERVER_URL = import.meta.env.VITE_SERVER_URL;

const FAUCET_ABI = [
  { inputs: [], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" },
  {
    inputs: [],
    name: "faucetBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

declare global {
  interface Window {
    ethereum?: any;
  }
}

const GetFunds: React.FC = () => {
  const { address: connectedAddress } = useAccount();
  const [wallet, setWallet] = useState<string>("");
  const [processingAvax, setProcessingAvax] = useState(false);
  const [successAvax, setSuccessAvax] = useState(false);
  const [processingUSDC, setProcessingUSDC] = useState(false);
  const [successUSDC, setSuccessUSDC] = useState(false);
  const [faucetBalance, setFaucetBalance] = useState<string | null>(null);

  useEffect(() => {
    if (connectedAddress && !wallet) {
      setWallet(connectedAddress);
    }
  }, [connectedAddress, wallet]);

  const fetchFaucetBalance = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);
      const contract = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, provider);
      const balance = await contract.faucetBalance();
      setFaucetBalance(ethers.formatEther(balance));
    } catch (err) {
      console.error("Failed to fetch faucet balance:", err);
      setFaucetBalance(null);
    }
  };

  useEffect(() => {
    fetchFaucetBalance();
  }, []);

  const handleMintAVAX = async () => {
    if (!ethers.isAddress(wallet)) {
      alert("Please enter a valid wallet address.");
      return;
    }
    setProcessingAvax(true);
    setSuccessAvax(false);
    try {
      const response = await fetch(`${SERVER_URL}/mint/${wallet}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Minting AVAX failed");
      setSuccessAvax(true);
      setTimeout(() => setSuccessAvax(false), 4000);
      await fetchFaucetBalance();
    } catch (err: any) {
      console.error(err);
      alert(`Minting AVAX failed: ${err.message || "Unknown error"}`);
    } finally {
      setProcessingAvax(false);
    }
  };

  const handleMintUSDC = async () => {
    if (!ethers.isAddress(wallet)) {
      alert("Please enter a valid wallet address.");
      return;
    }
    setProcessingUSDC(true);
    setSuccessUSDC(false);
    try {
      const response = await fetch(`${SERVER_URL}/mint-usdc/${wallet}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Minting mUSDC failed");
      setSuccessUSDC(true);
      setTimeout(() => setSuccessUSDC(false), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Minting mUSDC failed: ${err.message || "Unknown error"}`);
    } finally {
      setProcessingUSDC(false);
    }
  };

  const getButtonLabel = (type: "avax" | "usdc") => {
    const isProc = type === "avax" ? processingAvax : processingUSDC;
    const isSucc = type === "avax" ? successAvax : successUSDC;
    if (isProc) return "Processing...";
    if (isSucc) return "Minted!";
    return type === "avax" ? "Mint 0.1 Testnet AVAX" : "Mint 2000 mUSDC";
  };

  const isDisabled = (type: "avax" | "usdc") => {
    const isProc = type === "avax" ? processingAvax : processingUSDC;
    return !ethers.isAddress(wallet) || isProc;
  };

  const buttonClasses =
    "btn text-white font-bold transition-all duration-200 bg-blue-500 border-blue-500 hover:border-blue-600 hover:bg-blue-600 disabled:cursor-not-allowed";

  return (
    <div className="p-4 lg:pt-0 lg:py-2">
      <div className="flex flex-col gap-8 -mt-5">
        {/* AVAX Section */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center max-h-[calc((100vh-80px)/2)] overflow-hidden">
          <div className="w-full max-w-3xl lg:ml-8">
            {/* Mobile layout */}
            <div className="md:hidden -mt-6">
              <div className="flex items-center w-full h-48">
                <div className="flex-1 flex flex-col justify-center">
                  <h2 className="text-4xl xxs:text-2xl xs:text-2xl font-semibold whitespace-nowrap">
                    1. Mint AVAX
                  </h2>
                </div>
                <div className="ml-auto flex-shrink-0 h-full flex items-center justify-center">
                  <img
                    src="/images/AVAX-Tokens.png"
                    alt="Avalanche Token"
                    className="h-full w-auto object-contain"
                  />
                </div>
              </div>
              <div className="-mt-10 pt-2">
                <input
                  type="text"
                  placeholder="Enter your wallet address"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value.trim())}
                  className="bg-gray-900 border border-gray-300 rounded px-4 py-2 w-full focus:outline-none focus:border-2 focus:border-blue-500"
                />
              </div>
              {faucetBalance !== null && (
                <div className="mt-1 mb-4 text-sm font-semibold text-white">
                  Faucet balance: {parseFloat(faucetBalance).toFixed(4)} AVAX
                </div>
              )}
              <div className="mt-4 mb-4">
                <button
                  onClick={handleMintAVAX}
                  disabled={isDisabled("avax")}
                  className={`${buttonClasses} w-full mb-5`}
                >
                  {getButtonLabel("avax")}
                </button>
              </div>
            </div>

            {/* Desktop layout */}
            <div className="hidden md:block">
              <section className="mb-1">
                <h2 className="text-2xl font-semibold mb-2">1. Mint Testnet AVAX</h2>
                <div className="mt-1 flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4">
                  <input
                    type="text"
                    placeholder="Enter your wallet address"
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value.trim())}
                    className="bg-gray-900 border border-gray-300 rounded px-4 py-2 w-full md:w-1/2 focus:outline-none focus:border-2 focus:border-blue-500"
                  />
                  <button
                    onClick={handleMintAVAX}
                    disabled={isDisabled("avax")}
                    className={`${buttonClasses} w-full md:w-60`}
                  >
                    {getButtonLabel("avax")}
                  </button>
                </div>
              </section>
            </div>

            <div className="mt-1 hidden lg:block">
              {faucetBalance !== null && (
                <div className="mb-4 text-sm font-semibold text-white">
                  Faucet balance: {parseFloat(faucetBalance).toFixed(4)} AVAX
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:block ml-6">
            <img
              src="/images/AVAX-Tokens.png"
              alt="Avalanche Token"
              className="w-[350px] h-auto object-contain"
            />
          </div>
        </div>

        {/* mUSDC Section */}
        <div className="flex flex-col md:flex-row items-center max-h-[calc((100vh-80px)/2)] overflow-hidden transform md:-translate-y-7">
          <div className="w-full max-w-3xl lg:ml-8">
            {/* Mobile layout */}
            <div className="md:hidden -mt-10">
              <div className="flex items-center w-full h-48">
                <div className="flex-1 flex flex-col justify-center">
                  <h2 className="text-4xl xxs:text-xl xs:text-2xl font-semibold whitespace-nowrap">
                    2. Mint Testnet mUSDC
                  </h2>
                </div>
                <div className="ml-auto flex-shrink-0 h-full flex items-center justify-center">
                  <img
                    src="/images/USDC-Tokens.png"
                    alt="USDC Tokens"
                    className="h-full w-auto object-contain"
                  />
                </div>
              </div>
              <div className="-mt-10 pt-2">
                <input
                  type="text"
                  placeholder="Enter your wallet address"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value.trim())}
                  className="bg-gray-900 border border-gray-300 rounded px-4 py-2 w-full focus:outline-none focus:border-2 focus:border-blue-500"
                />
              </div>
              <div className="mb-4 mt-1 text-sm font-semibold text-white">
                Faucet balance: Unlimited
              </div>
              <div className="mt-4 mb-4">
                <button
                  onClick={handleMintUSDC}
                  disabled={isDisabled("usdc")}
                  className={`${buttonClasses} w-full mb-5`}
                >
                  {getButtonLabel("usdc")}
                </button>
              </div>
            </div>

            {/* Desktop layout */}
            <div className="hidden md:block">
              <section className="-mt-10">
                <h2 className="text-2xl font-semibold mb-2">2. Mint Testnet mUSDC</h2>
                <div className="mt-1 flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4">
                  <input
                    type="text"
                    placeholder="Enter your wallet address"
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value.trim())}
                    className="bg-gray-900 border border-gray-300 rounded px-4 py-2 w-full md:w-1/2 focus:outline-none focus:border-2 focus:border-blue-500"
                  />
                  <button
                    onClick={handleMintUSDC}
                    disabled={isDisabled("usdc")}
                    className={`${buttonClasses} w-full md:w-60`}
                  >
                    {getButtonLabel("usdc")}
                  </button>
                </div>
                <div className="mb-4 text-sm font-semibold text-white">
                  Faucet balance: Unlimited
                </div>
              </section>
            </div>
          </div>
          <div className="hidden lg:block ml-6">
            <img
              src="/images/USDC-Tokens.png"
              alt="USDC Tokens"
              className="w-[350px] h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GetFunds;
