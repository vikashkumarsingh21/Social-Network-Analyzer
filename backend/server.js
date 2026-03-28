/**
 * server.js
 * Social Network Analyzer — Express + MongoDB + Socket.io Backend
 */
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');
const socketModule = require('./utils/socket'); // Import socket wrapper

// ── Load env vars
dotenv.config();

// ── Connect to MongoDB
connectDB();

// ── Initialise Express
const app = express();

app.use(cors());
app.use(express.json());

// ── Mount Routers
const authRoutes       = require('./routes/authRoutes');
const userRoutes       = require('./routes/userRoutes');
const connectionRoutes = require('./routes/connectionRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', connectionRoutes);

// ── Health Check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🌐 Social Network Analyzer Pro API',
    data: { version: '3.0.0 (Real-Time)' }
  });
});

// ── 404 handler
app.use((req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
});

// ── Global Error handler
app.use(errorHandler);

// ── Start HTTP Server & Attach Socket.io ──
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Initialise socket.io on the running HTTP server
socketModule.init(server);
