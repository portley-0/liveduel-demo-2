import 'dotenv/config';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { deployMarket } from './services/deploy-market';
import { getUserPredictions } from './services/get-predictions'
import { startDataPolling, startMatchCachePolling } from './services/polling-aggregator';
import { initCache } from './cache';
import { initSocket } from './socket';

async function main() {
  const app = express();

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',  
    },
  });

  app.use(express.json());

  initCache();
  initSocket(io);
  startMatchCachePolling();
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
  

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error('Error starting server:', error);
});
