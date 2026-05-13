/**
 * RAJU LUDO — MULTIPLAYER SERVER
 * Express + Socket.io + MongoDB server.
 * Server-authoritative architecture with JWT auth and virtual economy.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import config from './src/config/index.js';
import { setupSocketHandlers } from './src/socket/SocketHandler.js';
import authRoutes from './src/routes/auth.js';
import economyRoutes from './src/routes/economy.js';

// ── Express App ──────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    server: 'Raju Ludo Multiplayer Server',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/economy', economyRoutes);

// ── HTTP Server + Socket.io ──────────────────────────────────────────────

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.clientOrigin,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e6,
});

setupSocketHandlers(io);

// ── MongoDB Connection ───────────────────────────────────────────────────

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('  📦 MongoDB connected');
  } catch (err) {
    console.warn('  ⚠️  MongoDB not available — running without database');
    console.warn('     (Auth & economy features disabled)');
    console.warn(`     Tried: ${config.mongoUri}`);
  }
}

// ── Start Server ─────────────────────────────────────────────────────────

async function start() {
  await connectDB();

  httpServer.listen(config.port, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║   🎲 RAJU LUDO — Multiplayer Server     ║');
    console.log(`  ║   Port: ${config.port}                            ║`);
    console.log(`  ║   Client: ${config.clientOrigin}     ║`);
    console.log('  ║   Status: READY                         ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
  });
}

start();

export { io };
