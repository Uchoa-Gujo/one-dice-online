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
  cors: { origin: '*', methods: ['GET', 'POST'] },
  serveClient: false,
  transports: ['websocket', 'polling'],
  pingInterval: Number(process.env.SOCKET_PING_INTERVAL_MS || 10000),
  pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT_MS || 28000),
  upgradeTimeout: Number(process.env.SOCKET_UPGRADE_TIMEOUT_MS || 10000),
  maxHttpBufferSize: Number(process.env.SOCKET_MAX_BUFFER_SIZE || 1e6),
  perMessageDeflate: false,
  connectionStateRecovery: {
    maxDisconnectionDuration: Number(process.env.SOCKET_RECOVERY_MS || 120000),
    skipMiddlewares: true
  }
});
app.set('io', io);
app.disable('x-powered-by');
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 3000);
server.keepAliveTimeout = Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS || 65000);
server.headersTimeout = Number(process.env.HTTP_HEADERS_TIMEOUT_MS || 66000);
server.requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS || 30000);
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


const corsOrigin = String(process.env.CORS_ORIGIN || '').trim();
app.use(cors({
  origin(origin, callback) {
    if (!origin || !corsOrigin) return callback(null, true);
    const allowed = corsOrigin.split(',').map(item => item.trim()).filter(Boolean);
    return callback(null, allowed.includes(origin));
  },
  credentials: true
}));
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

app.get('/api/health', async (_req, res) => {
  try {
    const db = await query('select now() as now');
    res.json({ ok: true, app: 'One Dice Online', version: packageInfo.version, db: 'ok', serverTime: db.rows[0]?.now });
  } catch (error) {
    res.status(503).json({ ok: false, app: 'One Dice Online', version: packageInfo.version, db: 'erro', error: error.message || 'Banco indisponível' });
  }
});

app.get('/api/health/layers', async (_req, res) => {
  try {
    const checks = await Promise.all([
      query("select to_regclass('public.users') as name"),
      query("select to_regclass('public.characters') as name"),
      query("select to_regclass('public.tables') as name"),
      query("select to_regclass('public.table_members') as name"),
      query("select to_regclass('public.chat_messages') as name"),
      query("select to_regclass('public.table_events') as name"),
      query("select to_regclass('public.table_presence') as name")
    ]);
    const layers = {
      auth: true,
      hub: true,
      campaign: true,
      sheet: true,
      realtime: true,
      database: checks.every(result => !!result.rows[0]?.name)
    };
    res.json({ ok: Object.values(layers).every(Boolean), app: 'One Dice Online', version: packageInfo.version, layers, serverTime: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, app: 'One Dice Online', version: packageInfo.version, error: error.message || 'Falha na validação de camadas' });
  }
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
    if (ext === '.html') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return;
    }
    if (['.js', '.css'].includes(ext)) {
      res.set('Cache-Control', 'no-cache, must-revalidate');
      return;
    }
    res.set('Cache-Control', 'public, max-age=86400');
  }
}));


// V176.2: protege reload em URLs limpas.
// Se uma rota profunda tentar pedir /personagem/style.css, /mesa/x/script.js,
// /personagem/assets/logo.jpg etc., entrega o arquivo real da raiz do client.
function sendClientAsset(req, res, relativePath) {
  const safeRelative = String(relativePath || '').replace(/^\/+/, '');
  const resolved = path.normalize(path.join(clientDir, safeRelative));
  if (!resolved.startsWith(clientDir)) return res.status(403).end();
  if (!fs.existsSync(resolved)) return res.status(404).end();
  res.sendFile(resolved);
}

app.get(/^\/.+\/(style\.css|script\.js)$/, (req, res) => {
  sendClientAsset(req, res, req.params[0]);
});

app.get(/^\/.+\/(block-inventory\/(?:style\.css|script\.js))$/, (req, res) => {
  sendClientAsset(req, res, req.params[0]);
});

app.get(/^\/.+\/(assets\/[^?#]+)$/, (req, res) => {
  sendClientAsset(req, res, req.params[0]);
});

app.get([
  '/',
  '/login',
  '/inicio',
  '/personagens',
  '/campanhas',
  '/mesas',
  '/fichas',
  '/ficha/:id',
  '/personagem/:id',
  '/campanha/:id',
  '/campanha/:id/:tab',
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
  const statements = [
    "alter table users add column if not exists avatar_url text",
    "alter table users add column if not exists revision bigint not null default 0",
    "alter table characters add column if not exists revision bigint not null default 0",
    "alter table tables add column if not exists description varchar(200) default ''",
    "alter table tables add column if not exists logo_url text default ''",
    "alter table tables add column if not exists revision bigint not null default 0",
    "alter table table_members add column if not exists revision bigint not null default 0",
    "create index if not exists idx_characters_owner_updated on characters(owner_id, updated_at desc)",
    "create index if not exists idx_characters_owner_name on characters(owner_id, lower(name))",
    "create index if not exists idx_characters_updated on characters(updated_at desc)",
    "create index if not exists idx_table_members_user on table_members(user_id, table_id)",
    "create index if not exists idx_table_members_table_user on table_members(table_id, user_id)",
    "create index if not exists idx_table_members_table_character on table_members(table_id, character_id)",
    "create index if not exists idx_table_members_character on table_members(character_id)",
    "create index if not exists idx_chat_messages_table_created on chat_messages(table_id, created_at)",
    "create index if not exists idx_chat_messages_table_id_created on chat_messages(table_id, id, created_at)",
    "create index if not exists idx_tables_owner_updated on tables(owner_id, updated_at desc)",
    "create index if not exists idx_tables_settings_gin on tables using gin(settings)",
    "create table if not exists table_events (id bigserial primary key, table_id uuid not null references tables(id) on delete cascade, event_name text not null, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now())",
    "create table if not exists table_presence (table_id uuid not null references tables(id) on delete cascade, user_id uuid not null references users(id) on delete cascade, last_seen timestamptz not null default now(), client_id text default '', primary key (table_id, user_id))",
    "create index if not exists idx_table_events_table_id on table_events(table_id, id)",
    "create index if not exists idx_table_events_table_created on table_events(table_id, created_at desc)",
    "create index if not exists idx_table_presence_table_seen on table_presence(table_id, last_seen desc)",
    "create index if not exists idx_table_presence_user_seen on table_presence(user_id, last_seen desc)",
    "create index if not exists idx_characters_data_gin on characters using gin(data)"
  ];
  for (const sql of statements) await query(sql);
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
