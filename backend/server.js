import 'dotenv/config';
import { db } from './lib/db.js';
// global error handlers to make backend errors visible in console
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection at promise:', reason);
});
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import { setupSocketHandlers } from './socket/socketHandlers.js';
import { initDb } from './scripts/initDb.js';

const app = express();
const httpServer = createServer(app);

// CORS: allow any origin (suitable for demo / learning deployments)
const corsOptions = {
  origin: true, // reflect request origin
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS', 'DELETE'],
  credentials: true,
};

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'WhatsApp Clone API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      chats: '/api/chats',
      messages: '/api/messages',
      announcements: '/api/announcements',
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/announcements', announcementRoutes);

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ message: err.message || 'Server error.' });
});

setupSocketHandlers(io);

const PORT = parseInt(process.env.PORT, 10) || 8000;
const PORT_EXPLICIT = process.env.PORT != null && process.env.PORT !== '';
const FALLBACK_PORTS = [8001, 8002, 8003, 8004, 8005, 8006, 8007];

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const server = httpServer.listen(port, () => resolve(port));
    server.on('error', reject);
  });
}

async function startServer() {
  let usedPort = PORT;
  if (PORT_EXPLICIT) {
    // Render / production: use only PORT from env, no fallback
    try {
      await tryListen(PORT);
    } catch (err) {
      console.error('Server failed to start:', err.message);
      process.exit(1);
    }
  } else {
    try {
      usedPort = await tryListen(PORT);
    } catch (err) {
      if (err.code !== 'EADDRINUSE') {
        console.error('Server failed to start:', err.message);
        process.exit(1);
      }
      for (const p of FALLBACK_PORTS) {
        try {
          usedPort = await tryListen(p);
          console.warn(`Port ${PORT} in use; using ${usedPort}. In frontend/.env set VITE_API_URL=http://localhost:${usedPort}`);
          break;
        } catch (e) {
          if (e.code !== 'EADDRINUSE') throw e;
        }
      }
      if (usedPort === PORT) {
        console.error(`Ports ${PORT}, ${FALLBACK_PORTS.join(', ')} in use. Free a port or set PORT in .env`);
        process.exit(1);
      }
    }
  }
  console.log(`Server running on port ${usedPort}`);
  try {
    await db.query('SELECT NOW()');
    console.log('Database connected successfully');
    await initDb(db);
  } catch (error) {
    console.error('Database connection error:', error.message);
  }
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
