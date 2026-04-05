import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export function initSocket(httpServer: HttpServer, frontendUrl: string): Server {
  io = new Server(httpServer, {
    cors: {
      origin: frontendUrl,
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`⚡ Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket() first.');
  }
  return io;
}
