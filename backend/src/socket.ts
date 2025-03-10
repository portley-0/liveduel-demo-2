import { Server } from 'http'
import { Server as SocketServer } from 'socket.io'

export function setupSocket(httpServer: Server) {
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' }
  })

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)
    
    // You might let them join a "match room" to get real-time updates
    // from your match view cache, for example:
    socket.on('joinMatch', (matchId) => {
      socket.join(`match-${matchId}`)
    })
  })
}
