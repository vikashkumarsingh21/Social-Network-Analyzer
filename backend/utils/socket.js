/**
 * utils/socket.js
 * Singleton to manage Socket.io instance
 */
let io;

module.exports = {
  init: (httpServer) => {
    const { Server } = require('socket.io');
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'DELETE']
      }
    });

    io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      console.warn('Socket.io not initialized, creating dummy emitter');
      return { emit: () => {} }; // graceful fallback for tests
    }
    return io;
  }
};
