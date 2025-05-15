import { Server as SocketIOServer, Socket } from 'socket.io';
import { getAllMatches, getAllTournaments } from './cache'; 
import { MatchData, TournamentData } from './cache';

let io: SocketIOServer;

export function initSocket(socketServer: SocketIOServer) {
  io = socketServer;
  console.log("WebSocket Server initialized!");

  io.on("connection", (socket: Socket) => {
    console.log("[socket] Client connected:", socket.id);

    socket.on("requestInitialCache", () => {
      console.log("[socket] Sending initial match cache...");
      const allMatches = getAllMatches();
      socket.emit("initialCache", allMatches);
    });

    socket.on("requestTournamentCache", () => {
      console.log("[socket] Sending initial tournament data...");
      const allTournaments = getAllTournaments();
      socket.emit("initialTournamentCache", allTournaments);
    });

    socket.on("disconnect", () => {
      console.log("[socket] Client disconnected:", socket.id);
    });
  });
}


export function broadcastMatchUpdate(match: MatchData) {
  if (!io) return; 
  io.emit('matchUpdate', match);
}

export function broadcastTournamentUpdate(tournament: TournamentData) {
  if (!io) return; 
  io.emit('tournamentUpdate', tournament);
}
