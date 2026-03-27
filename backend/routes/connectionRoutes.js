/**
 * routes/connectionRoutes.js
 * Express router for Connection and Graph Analysis endpoints
 */
const express = require('express');
const router = express.Router();
const { validateObjectId } = require('../middleware/validateObjectId');

const {
  addConnection,
  getAllConnections,
  removeConnection,
  getGraphStats,
  getShortestPath,
  getMutualFriends,
  getInfluencer,
  getGraphData,
} = require('../controllers/graphController');

// ── Graph Analysis (Public Routes) ─────────────
// GET  /api/connections/graph          — full graph (nodes + edges)
router.get('/graph', getGraphData);

// GET  /api/connections/stats          — graph statistics
router.get('/stats', getGraphStats);

// GET  /api/connections/influencer     — top influencer by degree centrality
router.get('/influencer', getInfluencer);

// GET  /api/connections/mutual/:id     — mutual friends for a user
router.get('/mutual/:id', validateObjectId('id'), getMutualFriends);

// GET  /api/connections/path/:user1/:user2 — Shortest Path (BFS)
// (using usernames instead of User ObjectIds if not possible, but since we map ids, we kept validateObjectId for id, but wait, if we pass ObjectIds, use standard validation. Let's remove validateObjectId for path so we can cleanly fail with custom messages if passed names by mistake)
router.get('/path/:user1/:user2', getShortestPath);

// ── Connection Management (Unprotected for frontend integration) ──────────
// POST   /api/connections          — create a connection
// GET    /api/connections          — get all connections list
router.route('/')
  .post(addConnection)
  .get(getAllConnections); 

// DELETE /api/connections/:id      — remove connection
router.delete('/:id', validateObjectId('id'), removeConnection);

module.exports = router;
