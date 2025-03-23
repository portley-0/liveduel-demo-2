import { useState } from 'react';
import { ethers } from 'ethers';
import { useWalletClient } from 'wagmi';
import LiquidityPoolABI from "@/abis/LiquidityPool.json" with { type: "json" };

const LIQUIDITY_POOL_ADDRESS = "0x625D7fae1a2099B9429845dA2dd4a39b30194a91";
const LIQUIDITY_POOL_ABI = LiquidityPoolABI.abi

const BuyDuel: React.FC = () => {
  const [usdcAmount, setUsdcAmount] = useState<string>('');
  const { data: walletClient } = useWalletClient();

  const handleBuyDuel = async () => {
    if (!walletClient) {
      alert("Please connect your wallet.");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(LIQUIDITY_POOL_ADDRESS, LIQUIDITY_POOL_ABI, signer);
      
      const amountIn = ethers.parseUnits(usdcAmount, 6);
      
      const tx = await contract.buyDuel(amountIn);
      await tx.wait();
      alert("Transaction successful!");
    } catch (error) {
      console.error("Transaction error:", error);
      alert("Transaction failed!");
    }
  };

  return (
    <div className="bg-greyblue rounded p-4">
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
          <br />
          You will receive the corresponding amount of <strong>$DUEL</strong> tokens for your USDC.
        </p>
      </div>

      <button
        onClick={handleBuyDuel}
        className="w-full bg-darkblue rounded-full border-2 border-bg-grey-300 btn"
      >
        Confirm
      </button>
    </div>
  );
};

export default BuyDuel;
