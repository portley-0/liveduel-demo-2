import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

//import { initPolling } from './services/pollingService'; // if you have a separate polling service

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // or your Vercel URL
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Soccer aggregator is running!');
});

//initPolling(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
