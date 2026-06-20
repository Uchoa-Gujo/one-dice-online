const jwt = require('jsonwebtoken');

function registerSockets(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('login_required'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch (error) {
      return next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('table:join', ({ tableId }) => {
      if (!tableId) return;
      socket.join(`table:${tableId}`);
    });

    socket.on('chat:message', ({ tableId, channel, message }) => {
      if (!tableId || !message) return;
      io.to(`table:${tableId}`).emit('chat:message', {
        tableId,
        channel: channel || 'conversation',
        message,
        user: socket.user,
        createdAt: new Date().toISOString()
      });
    });
  });
}

module.exports = { registerSockets };
