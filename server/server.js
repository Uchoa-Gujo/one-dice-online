require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const packageInfo = require('../package.json');
const authRoutes = require('./routes/auth');
const characterRoutes = require('./routes/characters');
const tableRoutes = require('./routes/tables');
const { registerSockets } = require('./sockets');
const { query } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
app.set('io', io);
app.disable('x-powered-by');

const PORT = Number(process.env.PORT || 3000);
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const uploadDir = process.env.UPLOAD_DIR || path.join(rootDir, 'uploads');
const LOG_REQUESTS = String(process.env.LOG_REQUESTS || '').toLowerCase() === 'true';

fs.mkdirSync(uploadDir, { recursive: true });

function setNoStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function sendIndex(_req, res) {
  setNoStore(res);
  res.sendFile(path.join(clientDir, 'index.html'));
}

app.use(cors());
app.use(express.json({ limit: process.env.JSON_LIMIT || '15mb' }));

if (LOG_REQUESTS) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
}

app.use('/uploads', express.static(uploadDir, {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'One Dice Online', version: packageInfo.version });
});

app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/tables', tableRoutes);

app.get('/obs/personagem/:id', (_req, res) => {
  setNoStore(res);
  res.sendFile(path.join(clientDir, 'obs.html'));
});

app.get('/obs.html', (_req, res) => {
  setNoStore(res);
  res.sendFile(path.join(clientDir, 'obs.html'));
});

app.use(express.static(clientDir, {
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.html', '.js', '.css'].includes(ext)) {
      res.set('Cache-Control', 'no-cache, must-revalidate');
      return;
    }
    res.set('Cache-Control', 'public, max-age=86400');
  }
}));

app.get([
  '/',
  '/login',
  '/inicio',
  '/personagens',
  '/campanhas',
  '/mesas',
  '/fichas',
  '/ficha/:id',
  '/mesa/:id',
  '/mesa/:id/*'
], sendIndex);

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Rota da API não encontrada.' });
  return sendIndex(req, res);
});

app.use((error, _req, res, _next) => {
  console.error('Erro interno:', error);
  res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
});

registerSockets(io);

async function ensureServerSchema() {
  await query("alter table users add column if not exists avatar_url text");
  await query("alter table tables add column if not exists description varchar(200) default ''");
  await query("alter table tables add column if not exists logo_url text default ''");
  await query("create index if not exists idx_characters_owner_updated on characters(owner_id, updated_at desc)");
  await query("create index if not exists idx_table_members_user on table_members(user_id, table_id)");
  await query("create index if not exists idx_chat_messages_table_created on chat_messages(table_id, created_at)");
}

process.on('unhandledRejection', error => {
  console.error('Falha assíncrona não tratada:', error);
});

async function startServer() {
  try {
    await ensureServerSchema();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`One Dice Online ${packageInfo.version} rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
