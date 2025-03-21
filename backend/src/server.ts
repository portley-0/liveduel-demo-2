import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from "cors";
import { Server as SocketIOServer } from 'socket.io';
import { deployMarket } from './services/deploy-market';
import { getUserPredictions } from './services/get-predictions'
import { startDataPolling, startFastSubgraphPolling, startMatchCachePolling, startStandingsPolling } from './services/polling-aggregator';
import { initCache, getMatchData } from './cache';
import { initSocket } from './socket';

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

  const PORT = process.env.PORT || 3000;
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });  
}

main().catch((error) => {
  console.error('Error starting server:', error);
});
