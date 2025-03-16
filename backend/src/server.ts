import 'dotenv/config';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { deployMarket } from './services/deploy-market';
import { getUserPredictions } from './services/get-predictions'
import { startDataPolling, startMatchCachePolling, startStandingsPolling } from './services/polling-aggregator';
import { initCache, getMatchData } from './cache';
import { initSocket } from './socket';

async function main() {
  const app = express();

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',  
      methods: ["GET", "POST"],
    },
  });

  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; connect-src 'self' ws://16.16.142.192:3000 wss://16.16.142.192:3000"
    );
    next();
  });

  app.use(express.json());

  initCache();
  initSocket(io);
  startMatchCachePolling();
  startStandingsPolling();
  startDataPolling();

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
  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error('Error starting server:', error);
});
