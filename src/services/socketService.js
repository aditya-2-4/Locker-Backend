import { Server } from 'socket.io';
import { config } from '../config/env.js';

let io = null;

export function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow connections from frontend dev and preview servers
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`⚡ WebSocket client connected: ${socket.id}`);

    socket.emit('connection:ack', {
      message: 'Connected to Smart Community Book Exchange Locker real-time stream',
      timestamp: new Date().toISOString(),
    });

    socket.on('disconnect', () => {
      console.log(`🔌 WebSocket client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitEvent(eventName, payload) {
  if (io) {
    io.emit(eventName, payload);
  }
}

export function getIO() {
  return io;
}
