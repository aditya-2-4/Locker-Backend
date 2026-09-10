import http from 'http';
import { execSync } from 'child_process';
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
// System Reset Endpoint (Temporary for wiping fake data)
app.get('/api/system/reset', async (req, res) => {
  try {
    const { prisma } = await import('./config/db.js');
    await prisma.transaction.deleteMany();
    await prisma.book.deleteMany();
    await prisma.compartment.deleteMany();
    await prisma.locker.deleteMany();
    await prisma.user.deleteMany();
    res.json({ message: 'All fake data removed. Database is now completely empty.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Root Route - Backend Status Dashboard
app.get('/', async (req, res) => {
  // Check DB connection
  let dbStatus = 'Disconnected';
  let dbColor = 'bg-red-500';
  let dbText = 'text-red-700';
  let dbBg = 'bg-red-50';
  try {
    const { prisma } = await import('./config/db.js');
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'Connected';
    dbColor = 'bg-emerald-500';
    dbText = 'text-emerald-700';
    dbBg = 'bg-emerald-50';
  } catch (err) {
    console.error('Dashboard DB Check Error:', err);
  }

  const frontendUrl = 'https://locker-frontend-two.vercel.app/';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Locker Backend | System Status</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Inter', sans-serif; background-color: #f8fafc; background-image: radial-gradient(#e2e8f0 1px, transparent 1px); background-size: 20px 20px; }
        </style>
    </head>
    <body class="min-h-screen flex items-center justify-center p-4">
        <div class="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 relative">
            <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
            
            <div class="p-8">
                <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-emerald-200">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                </div>

                <h1 class="text-2xl font-extrabold text-slate-800 tracking-tight mb-2">Backend Server</h1>
                <p class="text-sm text-slate-500 font-medium mb-8">Smart Community Book Locker System</p>

                <div class="space-y-4 mb-8">
                    <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div class="flex items-center gap-3">
                            <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                            <span class="font-semibold text-slate-700 text-sm">API Services</span>
                        </div>
                        <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">ONLINE</span>
                    </div>

                    <div class="flex items-center justify-between p-4 ${dbBg} rounded-2xl border border-slate-100">
                        <div class="flex items-center gap-3">
                            <div class="w-2.5 h-2.5 rounded-full ${dbColor}"></div>
                            <span class="font-semibold text-slate-700 text-sm">Database</span>
                        </div>
                        <span class="text-xs font-bold ${dbText} bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">${dbStatus}</span>
                    </div>
                </div>

                <a href="${frontendUrl}" target="_blank" class="block w-full text-center py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm transition-all transform hover:scale-[1.02] shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">
                    Open Frontend Dashboard &rarr;
                </a>
            </div>
            <div class="bg-slate-50 py-3 text-center border-t border-slate-100">
                <span class="text-xs font-mono text-slate-400 font-medium tracking-wide">Version 1.0.0 &bull; Running on Render</span>
            </div>
        </div>
    </body>
    </html>
  `;
  res.send(html);
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
// Generation logic moved to index.js

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
