const jwt = require('jsonwebtoken');
const { parseCookieHeader, AUTH_COOKIE_NAME } = require('../middleware');

// V194.3 - presença por socket organizada por socketId + timestamp.
// Evita jogador preso online quando o navegador reconecta ou duplica join.
const tablePresence = new Map(); // tableId -> userId -> socketId -> lastSeen
const STALE_MS = Number(process.env.SOCKET_PRESENCE_STALE_MS || 45000);

function now() { return Date.now(); }
function tableKey(tableId) { return String(tableId || ''); }
function userKey(socket) { return String(socket.user?.id || ''); }

function ensureTable(tableId) {
  const key = tableKey(tableId);
  if (!tablePresence.has(key)) tablePresence.set(key, new Map());
  return tablePresence.get(key);
}

function cleanupTable(tableId) {
  const key = tableKey(tableId);
  const table = tablePresence.get(key);
  if (!table) return;
  const cutoff = now() - STALE_MS;
  for (const [userId, sockets] of table.entries()) {
    for (const [socketId, lastSeen] of sockets.entries()) {
      if (Number(lastSeen || 0) < cutoff) sockets.delete(socketId);
    }
    if (!sockets.size) table.delete(userId);
  }
  if (!table.size) tablePresence.delete(key);
}

function usersFor(tableId) {
  cleanupTable(tableId);
  const users = tablePresence.get(tableKey(tableId));
  return users ? Array.from(users.keys()) : [];
}

function emitPresence(io, tableId, socket = null) {
  const payload = {
    tableId: tableKey(tableId),
    onlineUserIds: usersFor(tableId),
    at: new Date().toISOString(),
    source: 'socket'
  };
  if (socket) socket.emit('presence:updated', payload);
  else io.to(`table:${tableKey(tableId)}`).emit('presence:updated', payload);
}

function addPresence(io, socket, tableId) {
  const key = tableKey(tableId);
  const uid = userKey(socket);
  if (!key || !uid) return;

  socket.data.tables = socket.data.tables || new Set();
  socket.join(`table:${key}`);
  socket.data.tables.add(key);

  const table = ensureTable(key);
  if (!table.has(uid)) table.set(uid, new Map());
  table.get(uid).set(socket.id, now());
  emitPresence(io, key);
}

function removePresence(io, socket, tableId) {
  const key = tableKey(tableId);
  const uid = userKey(socket);
  if (!key || !uid) return;

  socket.data.tables = socket.data.tables || new Set();
  socket.data.tables.delete(key);
  socket.leave(`table:${key}`);

  const table = tablePresence.get(key);
  if (table?.has(uid)) {
    const sockets = table.get(uid);
    sockets.delete(socket.id);
    if (!sockets.size) table.delete(uid);
    if (!table.size) tablePresence.delete(key);
  }
  emitPresence(io, key);
}

function registerSockets(io) {
  io.use((socket, next) => {
    const cookies = parseCookieHeader(socket.handshake.headers?.cookie || '');
    const token = socket.handshake.auth?.token || cookies[AUTH_COOKIE_NAME];
    if (!token) return next(new Error('login_required'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.tables = new Set();
      return next();
    } catch (error) {
      return next(new Error('invalid_token'));
    }
  });

  const cleanupTimer = setInterval(() => {
    for (const tableId of Array.from(tablePresence.keys())) {
      cleanupTable(tableId);
      emitPresence(io, tableId);
    }
  }, Number(process.env.SOCKET_PRESENCE_CLEANUP_MS || 15000));
  cleanupTimer.unref?.();

  io.on('connection', (socket) => {
    socket.emit('socket:ready', {
      userId: socket.user?.id,
      socketId: socket.id,
      at: new Date().toISOString()
    });

    socket.on('table:join', ({ tableId }, ack) => {
      if (!tableId) return;
      addPresence(io, socket, tableId);
      if (typeof ack === 'function') ack({ ok: true, tableId: tableKey(tableId), onlineUserIds: usersFor(tableId) });
      socket.emit('table:joined', { tableId: tableKey(tableId), onlineUserIds: usersFor(tableId), at: new Date().toISOString() });
    });

    socket.on('table:leave', ({ tableId }, ack) => {
      if (!tableId) return;
      removePresence(io, socket, tableId);
      if (typeof ack === 'function') ack({ ok: true, tableId: tableKey(tableId), onlineUserIds: usersFor(tableId) });
    });

    socket.on('presence:get', ({ tableId }, ack) => {
      if (!tableId) return;
      const payload = { tableId: tableKey(tableId), onlineUserIds: usersFor(tableId), at: new Date().toISOString(), source: 'socket-get' };
      socket.emit('presence:updated', payload);
      if (typeof ack === 'function') ack(payload);
    });

    socket.on('table:ping', ({ tableId }, ack) => {
      if (!tableId) return;
      addPresence(io, socket, tableId);
      const payload = { ok: true, tableId: tableKey(tableId), onlineUserIds: usersFor(tableId), at: new Date().toISOString() };
      socket.emit('presence:updated', { ...payload, source: 'socket-ping' });
      if (typeof ack === 'function') ack(payload);
    });

    socket.on('chat:message', ({ tableId, channel, message }) => {
      if (!tableId || !message) return;
      io.to(`table:${tableKey(tableId)}`).emit('chat:message', {
        tableId: tableKey(tableId),
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
