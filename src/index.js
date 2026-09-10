import http from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocketIO } from './services/socketService.js';
import { initMQTT } from './config/mqtt.js';
import { handleIncomingMQTT } from './services/mqttService.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import lockerRoutes from './routes/locker.routes.js';
import bookRoutes from './routes/book.routes.js';
import txRoutes from './routes/tx.routes.js';
import rfidRoutes from './routes/rfid.routes.js';

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

app.use(express.json());

// Request logging in dev
app.use((req, res, next) => {
  if (config.nodeEnv === 'development' && !req.url.includes('/health')) {
    console.log(`[${req.method}] ${req.url}`);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Smart Community Book Exchange Locker API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/lockers', lockerRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/transactions', txRoutes);
app.use('/api/rfid', rfidRoutes);

// API Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Smart Community Book Exchange Locker API',
    status: 'Running',
    docs: '/api/health'
  });
});

// Fallback for unknown API routes
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    next();
  }
});

// Error Handler
app.use(errorHandler);

// Initialize real-time servers
async function startServer() {
  try {
    // 1. Connect database
    await connectDB();

    // 2. Initialize Socket.IO
    initSocketIO(server);
    console.log('⚡ Socket.IO initialized');

    // 3. Initialize MQTT Broker & Client
    await initMQTT(handleIncomingMQTT);

    // 4. Start HTTP Server
    server.listen(config.port, () => {
      console.log(`🚀 Smart Community Book Locker Server running on http://localhost:${config.port}`);
      console.log(`🌐 Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, server };
