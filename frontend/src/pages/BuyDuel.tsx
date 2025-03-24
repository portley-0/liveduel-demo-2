import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { ethers } from 'ethers';
import { useWalletClient } from 'wagmi';
import LiquidityPoolABI from "@/abis/LiquidityPool.json" with { type: "json" };
import MockUSDCABI from "@/abis/MockUSDC.json" with { type: "json" };

const LIQUIDITY_POOL_ADDRESS = "0x625D7fae1a2099B9429845dA2dd4a39b30194a91";
const LIQUIDITY_POOL_ABI = LiquidityPoolABI.abi;

const USDC_ADDRESS = "0xB1cC53DfF11c564Fbe22145a0b07588e7648db74";
const USDC_ABI = MockUSDCABI.abi;

const AVALANCHE_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

const BuyDuel: React.FC = () => {
  const [usdcAmount, setUsdcAmount] = useState<string>('');
  const [estimatedDuel, setEstimatedDuel] = useState<string>('');
  const { data: walletClient } = useWalletClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ shares: "", cost: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const tradeType = "buy";

  const closeModal = () => setIsModalOpen(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const publicProvider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);

  useEffect(() => {
    const fetchEstimatedDuel = async () => {
      if (!usdcAmount || Number(usdcAmount) <= 0) {
        setEstimatedDuel('');
        return;
      }
      try {
        const liquidityPoolContract = new ethers.Contract(
          LIQUIDITY_POOL_ADDRESS, 
          LIQUIDITY_POOL_ABI, 
          publicProvider
        );
        const [usdcReserve, duelReserve] = await liquidityPoolContract.getReserves();
        const amountIn = ethers.parseUnits(usdcAmount, 6);
        const estimated = await liquidityPoolContract.getSwapAmount(amountIn, usdcReserve, duelReserve);
        const estimatedFormatted = ethers.formatUnits(estimated, 18);
        setEstimatedDuel(estimatedFormatted);
      } catch (error) {
        console.error("Error fetching estimated DUEL amount", error);
        setEstimatedDuel('');
      }
    };

    fetchEstimatedDuel();
  }, [usdcAmount, publicProvider]);

  const handleBuyDuel = async () => {
    if (!walletClient) {
      alert("Please connect your wallet.");
      return;
    }
    try {
      setIsProcessing(true);
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      const amountIn = ethers.parseUnits(usdcAmount, 6);
      
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const approveTx = await usdcContract.approve(LIQUIDITY_POOL_ADDRESS, amountIn);
      await approveTx.wait();
      
      const liquidityPoolContract = new ethers.Contract(LIQUIDITY_POOL_ADDRESS, LIQUIDITY_POOL_ABI, signer);
      const tx = await liquidityPoolContract.buyDuel(amountIn);
      await tx.wait();
      
      setModalData({ shares: estimatedDuel, cost: Number(usdcAmount) });
      setIsModalOpen(true);
    } catch (error) {
      console.error("Transaction error:", error);
      alert("Transaction failed!");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="min-h-screen overflow-hidden px-4 sm:px-0">
        <div className="mt-8 bg-greyblue rounded-xl p-4 w-full max-w-md mx-auto">
          <h2 className="text-xl font-bold mb-4">Add Liquidity</h2>

          <div className="flex items-center mb-4">
            <span className="mr-2">USDC</span>
            <input
              type="number"
              value={usdcAmount}
              onChange={(e) => setUsdcAmount(e.target.value)}
              placeholder="0"
              className="bg-darkblue rounded p-2 flex-1"
            />
          </div>

          <div className="bg-darkblue rounded p-4 mb-4">
            <p>
              The <strong>$DUEL</strong> ecosystem token can be used to earn liquidity rewards via staking through the reward per share system. Half of the 4% transaction fee for bets (2% off every bet) goes to the liquidity rewards pool.
            </p>
            {estimatedDuel && (
              <p className="mt-2">
                You will receive <strong>{estimatedDuel} DUEL</strong> tokens.
              </p>
            )}
          </div>

          <button
            onClick={handleBuyDuel}
            disabled={isProcessing}
            className={`w-full bg-darkblue rounded-full border-2 border-bg-grey-300 btn ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isProcessing ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>

      <Dialog open={isModalOpen} onClose={closeModal} className="fixed inset-0 flex items-center justify-center z-50">
        <div className="fixed inset-0 bg-black opacity-50"></div>
        <div className="bg-greyblue p-6 rounded-lg shadow-lg w-auto max-w-md sm:max-w-xs mx-4 sm:mx-auto text-center relative z-50">
          <h2 className="text-white text-2xl sm:text-xl font-semibold mb-3">Success</h2>
          <p className="text-gray-300 text-lg sm:text-base">
            {tradeType === "buy" ? "You purchased" : "You sold"}{" "}
            <span className="text-white font-bold">{modalData.shares}</span> DUEL tokens
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
    </>
  );
};

export default BuyDuel;
