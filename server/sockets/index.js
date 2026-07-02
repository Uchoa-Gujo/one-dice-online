const jwt = require('jsonwebtoken');

const tablePresence = new Map();

function usersFor(tableId) {
  const users = tablePresence.get(String(tableId));
  return users ? Array.from(users.keys()) : [];
}

function emitPresence(io, tableId, socket = null) {
  const payload = {
    tableId: String(tableId),
    onlineUserIds: usersFor(tableId),
    at: new Date().toISOString()
  };
  if (socket) socket.emit('presence:updated', payload);
  else io.to(`table:${tableId}`).emit('presence:updated', payload);
}

function addPresence(io, socket, tableId) {
  if (!tableId || !socket.user?.id) return;
  const key = String(tableId);
  socket.data.tables = socket.data.tables || new Set();

  // v1.90.5: não incrementar presença se este mesmo socket já entrou na sala.
  // Antes, chamadas repetidas de table:join podiam deixar jogador preso como online.
  if (socket.data.tables.has(key)) {
    emitPresence(io, key);
    return;
  }

  socket.join(`table:${key}`);
  socket.data.tables.add(key);

  if (!tablePresence.has(key)) tablePresence.set(key, new Map());
  const users = tablePresence.get(key);
  const userId = String(socket.user.id);
  users.set(userId, (users.get(userId) || 0) + 1);
  emitPresence(io, key);
}

function removePresence(io, socket, tableId) {
  if (!tableId || !socket.user?.id) return;
  const key = String(tableId);
  socket.data.tables = socket.data.tables || new Set();

  // Se este socket não estava contado nessa mesa, só devolve o estado atual.
  if (!socket.data.tables.has(key)) {
    emitPresence(io, key);
    return;
  }

  socket.data.tables.delete(key);
  socket.leave(`table:${key}`);

  const users = tablePresence.get(key);
  if (!users) {
    emitPresence(io, key);
    return;
  }
  const userId = String(socket.user.id);
  const next = (users.get(userId) || 0) - 1;
  if (next > 0) users.set(userId, next);
  else users.delete(userId);
  if (!users.size) tablePresence.delete(key);
  emitPresence(io, key);
}

function registerSockets(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('login_required'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.tables = new Set();
      return next();
    } catch (error) {
      return next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('table:join', ({ tableId }) => {
      if (!tableId) return;
      addPresence(io, socket, tableId);
    });

    socket.on('table:leave', ({ tableId }) => {
      if (!tableId) return;
      removePresence(io, socket, tableId);
    });

    // v1.90.5: cliente pode pedir uma lista atual sem recontar presença.
    socket.on('presence:get', ({ tableId }) => {
      if (!tableId) return;
      emitPresence(io, String(tableId), socket);
    });

    // v1.90.5: heartbeat leve; mantém a sala/presença sem duplicar contagem.
    socket.on('table:ping', ({ tableId }) => {
      if (!tableId) return;
      addPresence(io, socket, tableId);
      emitPresence(io, String(tableId), socket);
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

    socket.on('disconnect', () => {
      const tables = Array.from(socket.data.tables || []);
      tables.forEach(tableId => removePresence(io, socket, tableId));
      socket.data.tables?.clear?.();
    });
  });
}

module.exports = { registerSockets };
