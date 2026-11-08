const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const { initDB, getDbMode } = require('./config/db');
const { setupSocketIO } = require('./services/trackingEngine');

const authRoutes = require('./routes/auth');
const routesRouter = require('./routes/routes');
const busesRouter = require('./routes/buses');
const tripsRouter = require('./routes/trips');
const announcementsRouter = require('./routes/announcements');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// CORS setup for web and PWA
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 10000,
  pingInterval: 5000
});

// Setup Socket.IO tracking engine & watchdog
setupSocketIO(io);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    name: 'NITTE Bus Tracker API',
    time: new Date().toISOString(),
    dbMode: getDbMode()
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/routes', routesRouter);
app.use('/api/buses', busesRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/announcements', announcementsRouter);

// Catch 404
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.url}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    await initDB();
    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚍 NITTE Bus Tracker Backend running on port ${PORT}`);
      console.log(`📡 Socket.IO tracking engine initialized`);
      console.log(`💾 Database mode: ${getDbMode()}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
