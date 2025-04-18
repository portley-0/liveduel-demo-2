import 'dotenv/config';
import http from 'http';
import express, { Request, Response } from 'express';
import cors from "cors";
import { Server as SocketIOServer } from 'socket.io';
import { deployMarket } from './services/deploy-market';
import { getUserPredictions } from './services/get-predictions'
import { startDataPolling, startFastSubgraphPolling, startMatchCachePolling, startStandingsPolling } from './services/polling-aggregator';
import { initCache, getMatchData } from './cache';
import { initSocket } from './socket';
import { ethers } from "ethers";


const FAUCET_ABI = [
  {
    inputs: [{ name: "recipient", type: "address" }],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  }
];

const USDC_FAUCET_ABI = [
  {
    inputs: [
      { name: "amount", type: "uint256" }
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "recipient", type: "address" }
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  }
];


const USDC_FAUCET_ADDRESS = process.env.USDC_FAUCET_ADDRESS!;
const FAUCET_ADDRESS = process.env.FAUCET_ADDRESS!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const AVALANCHE_FUJI_RPC = process.env.AVALANCHE_FUJI_RPC!;

async function main() {
  const app = express();
  app.use(cors({
    origin: [
      "http://localhost:5173",
      "https://liveduel-demo-2.app",
      "https://www.liveduel-demo-2.app",
      "https://api.liveduel-demo-2.app"
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  }));
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {  
      methods: ["GET", "POST"],
    },
  });

  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; connect-src 'self' https://api.liveduel-demo-2.app wss://api.liveduel-demo-2.app ws://localhost:3000; img-src * data: blob:; script-src 'self';"
    );
    next();
  });

  app.use(express.json());

  initCache();
  initSocket(io);
  startMatchCachePolling();
  startStandingsPolling();
  startDataPolling();
  startFastSubgraphPolling();

  app.post('/deploy', async (req, res) => {
    try {
      const { matchId, matchTimestamp } = req.body;
  
      const newMarketAddress = await deployMarket(matchId, matchTimestamp);
      
      res.json({ success: true, newMarketAddress });
    } catch (error: any) {
      console.error('Error in /deploy route:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/predictions/:userAddress', async (req, res) => {
    try {
      const userAddress = req.params.userAddress;

      const predictions = await getUserPredictions(userAddress);
  
      res.json({ success: true, data: predictions });
    } catch (error: any) {
      console.error('Error fetching predictions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/debug/:matchid', (req, res) => {
    const matchId = Number(req.params.matchid);
    const match = getMatchData(matchId);
    res.json({ success: true, data: match });
  });

  app.post('/mint/:walletAddress', async (req: Request<{ walletAddress: string }>, res: Response): Promise<void> => {
    const { walletAddress } = req.params;
  
    if (!ethers.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address.' });
    }
  
    try {
      const provider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);
      const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  
      const faucet = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, signer);
  
      const tx = await faucet.mint(walletAddress);
      await tx.wait();
  
      res.json({ success: true, txHash: tx.hash });
    } catch (error: any) {
      console.error('Mint error:', error);
      res.status(500).json({ error: error.reason || error.message || 'Minting failed' });
    }
  });

  app.post('/mint-usdc/:walletAddress', async (req: Request<{ walletAddress: string }>, res: Response): Promise<void> => {
    const { walletAddress } = req.params;
  
    if (!ethers.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address.' });
    }
  
    try {
      const provider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);
      const signer = new ethers.Wallet(PRIVATE_KEY, provider);
      const faucet = new ethers.Contract(USDC_FAUCET_ADDRESS, USDC_FAUCET_ABI, signer);
      const tx = await faucet["mint(address)"](walletAddress);
      await tx.wait();
      res.json({ success: true, txHash: tx.hash });
    } catch (error: any) {
      console.error('USDC mint error:', error);
      res.status(500).json({ error: error.reason || error.message || 'Minting mUSDC failed' });
    }
  });
  
  const PORT = process.env.PORT || 3000;
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });  
}

main().catch((error) => {
  console.error('Error starting server:', error);
});
