import { Server as SocketIOServer, Socket } from 'socket.io';
import { getAllMatches } from './cache'; 
import { MatchData } from './cache';

let io: SocketIOServer;

export function initSocket(socketServer: SocketIOServer) {
  io = socketServer;

  io.on('connection', (socket: Socket) => {
    console.log('[socket] Client connected:', socket.id);

    socket.on('requestInitialCache', () => {
      const allMatches = getAllMatches();
      socket.emit('initialCache', allMatches);
    });

    socket.on('disconnect', () => {
      console.log('[socket] Client disconnected:', socket.id);
    });
  });
}

export function broadcastMatchUpdate(match: MatchData) {
  if (!io) return; 
  io.emit('matchUpdate', match);
}
