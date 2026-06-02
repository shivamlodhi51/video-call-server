import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import roomRoutes from './routes/room.routes';
import { setupSignalingSocket } from './sockets/signaling.socket';
import { errorHandler } from './middleware/error.middleware';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.IP_FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: true, // Dynamically mirror the requesting origin to support credentials: true
    credentials: true,
  })
);

// REST Routes
app.use('/api/rooms', roomRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Signaling server is running' });
});

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: (requestOrigin, callback) => {
      // Dynamically allow any incoming Socket.IO connection origin to support credentials: true
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000, // Detect disconnections faster
});

setupSignalingSocket(io);

// Global Error Handler
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   SIGNALING SERVER IS LIVE ON PORT ${PORT}`);
  console.log(`   CORS ALLOWED FROM: ${FRONTEND_URL}`);
  console.log(`===============================================`);
});
