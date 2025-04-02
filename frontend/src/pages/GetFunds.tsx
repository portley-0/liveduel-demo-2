import React, { useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";

const FAUCET_ADDRESS = "0x88F535380AB4Eb4F7EDa26f2c0551C6D321d0AeA";
const AVALANCHE_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

const FAUCET_ABI = [
  {
    inputs: [],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
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
  const { data: walletClient } = useWalletClient();

  const [wallet, setWallet] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [faucetBalance, setFaucetBalance] = useState<string | null>(null);

  useEffect(() => {
    if (connectedAddress && !wallet) {
      setWallet(connectedAddress);
    }
  }, [connectedAddress]);

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

  const getSigner = async () => {
    let provider;
    if (walletClient) {
      provider = new ethers.BrowserProvider(walletClient as any);
    } else if (typeof window !== "undefined" && window.ethereum) {
      const raw = window.ethereum;
      const accounts = await raw.request({ method: "eth_accounts" });
      if (!accounts || accounts.length === 0) {
        await raw.request({ method: "eth_requestAccounts" });
      }
      provider = new ethers.BrowserProvider(raw);
    } else {
      console.error("No wallet provider found");
      return null;
    }
    const signer = await provider.getSigner();
    return signer;
  };
  
  const handleMint = async () => {
    if (!wallet) {
      alert("Please enter a wallet address.");
      return;
    }
    setProcessing(true);
    setSuccess(false);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("No signer available");
      const faucet = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, signer);
      const tx = await faucet.mint();
      await tx.wait();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      await fetchFaucetBalance();
    } catch (err: any) {
      console.error("Mint error:", err);
      alert("Minting failed: " + (err.reason || err.message || "Unknown error"));
    } finally {
      setProcessing(false);
    }
  };

  const getButtonLabel = () => {
    if (processing) return "Processing...";
    if (success) return "Minted!";
    return "Mint 0.1 Testnet AVAX";
  };

  const getButtonClasses = () => {
    const base = "btn text-white font-bold transition-all duration-200";
    const state = success
      ? "bg-green-500 border-green-500 hover:bg-green-600 hover:border-green-600"
      : "bg-blue-500 border-blue-500 hover:border-blue-600 hover:bg-blue-600";
    const disabled = processing ? "disabled:cursor-not-allowed" : "";
    return `${base} ${state} ${disabled}`;
  };

  return (
    <div className="flex items-start md:items-center justify-start min-h-screen p-4 font-sans mt-[-80px] w-full">
      <div className="w-full max-w-3xl lg:ml-8">
        <div className="md:hidden mt-6">
          <div className="flex items-stretch">
            <div className="flex flex-col justify-center h-48">
              <h1 className="text-3xl font-bold mt-5 ">Get Funds</h1>
              <h2 className="text-xl font-semibold mt-6">Mint Testnet AVAX</h2>
            </div>
            <div className="h-48 flex items-center justify-center">
              <img
                src="/images/AVAX-Tokens.png"
                alt="Avalanche Token"
                className="h-full w-auto"
              />
            </div>
          </div>
          <div className="-mt-6">
            <input
              type="text"
              placeholder="Enter your wallet address"
              className="bg-gray-900 border border-gray-300 rounded px-4 py-2 w-full focus:outline-none focus:border-2 focus:border-blue-500"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
          </div>

          {faucetBalance !== null && (
            <div className="mt-1 mb-4 text-sm font-semibold text-white">
              Faucet balance: {parseFloat(faucetBalance).toFixed(4)} AVAX
            </div>
          )}
          <div className="mt-4 mb-4">
            <button
              onClick={handleMint}
              disabled={processing}
              className={`${getButtonClasses()} w-full mb-5`}
            >
              {getButtonLabel()}
            </button>
          </div>
        </div>

        <div className="hidden md:block">
          <h1 className="text-3xl font-bold mb-4">Get Funds</h1>
          <section className="mb-1">
            <h2 className="text-xl font-semibold mb-2">Mint Testnet AVAX</h2>
            <div className="mt-1 flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4">
              <input
                type="text"
                placeholder="Enter your wallet address"
                className="bg-gray-900 border border-gray-300 rounded px-4 py-2 w-full md:w-1/2 focus:outline-none focus:border-2 focus:border-blue-500"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
              />
              <button
                onClick={handleMint}
                disabled={processing}
                className={`${getButtonClasses()} w-full md:w-60`}
              >
                {getButtonLabel()}
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
        <section className="md:block">
          <h2 className="text-xl font-semibold mb-4">Acquire mUSDC Tokens</h2>
          <p className="mb-4">
            To acquire mUSDC tokens, please visit{" "}
            <a
              href="https://mock-usdc.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              mock-usdc.xyz
            </a>
            .
          </p>
        </section>
      </div>

      <div className="hidden lg:block ml-8">
        <img
          src="/images/AVAX-Tokens.png"
          alt="Avalanche Token"
          className="w-auto h-auto object-contain"
        />
      </div>
    </div>
  );
};

export default GetFunds;
