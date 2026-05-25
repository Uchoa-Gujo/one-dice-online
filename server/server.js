require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
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

const PORT = Number(process.env.PORT || 3000);
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const uploadDir = process.env.UPLOAD_DIR || path.join(rootDir, 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'One Dice Online', version: '0.75.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/tables', tableRoutes);

app.get('/obs/personagem/:id', (req, res) => {
  res.sendFile(path.join(clientDir, 'obs.html'));
});
app.use(express.static(clientDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

registerSockets(io);

async function ensureServerSchema() {
  await query("alter table users add column if not exists avatar_url text");
}

async function startServer() {
  try {
    await ensureServerSchema();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`One Dice Online rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
