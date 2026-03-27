/**
 * server.js
 * Social Network Analyzer — Express + MongoDB Backend
 * Entry point: boots the server and mounts all routes
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// ── Load env vars ────────────────────────────
dotenv.config();

// ── Connect to MongoDB ───────────────────────
connectDB();

// ── Initialise Express ───────────────────────
const app = express();

// ── Middleware ───────────────────────────────
// Allow requests from any origin (update in production to restrict by domain)
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// ── Mount Routers ────────────────────────────
const authRoutes       = require('./routes/authRoutes');
const userRoutes       = require('./routes/userRoutes');
const connectionRoutes = require('./routes/connectionRoutes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', connectionRoutes);

// ── Health Check ─────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🌐 Social Network Analyzer API is running',
    data: {
      version: '2.0.0',
      endpoints: {
        auth:         '/api/auth/register | /login',
        users:        'GET /api/users | GET /api/users/search?q=name',
        deleteUser:   'DELETE /api/users/:id',
        connections:  'GET | POST /api/connections | DELETE /api/connections/:id',
        graph:        'GET /api/connections/graph',
        stats:        'GET /api/connections/stats',
        influencer:   'GET /api/connections/influencer',
        mutual:       'GET /api/connections/mutual/:id',
        path:         'GET /api/connections/path/:user1/:user2',
      }
    }
  });
});

// ── 404 handler ──────────────────────────────
app.use((req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
});

// ── Global Error handler ─────────────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
