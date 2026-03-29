/**
 * routes/connectionRoutes.js
 * Express router for Connection and Advanced Graph Math endpoints
 */
const express = require('express');
const router = express.Router();
const { validateObjectId } = require('../middleware/validateObjectId');
const { protect, authorize } = require('../middleware/auth');

const {
  addConnection,
  getAllConnections,
  removeConnection,
  getGraphStats,
  getShortestPath,
  getGraphData,
  getClusteringCoefficient,
  getCentrality,
  getCommunities,
  getRecommendations
} = require('../controllers/graphController');

// ── Graph Math & Analytics (Public or Admin) ──
router.get('/graph', getGraphData);
router.get('/stats', getGraphStats);
router.get('/clusters', getClusteringCoefficient);
router.get('/centrality', getCentrality);
router.get('/communities', getCommunities);
router.get('/recommendations/:userId', validateObjectId('userId'), getRecommendations);

// Backwards compat for influencer / mutuals
router.get('/influencer', getCentrality);

// Shortest path
router.get('/path/:user1/:user2', getShortestPath);

// ── Connection Management ─────────────────────
// Protected for admins/users based on implementation, but kept open per earlier steps,
// wait, we are adding Auth back in per the new requirements!
router.route('/')
  .post(protect, authorize('admin', 'user'), addConnection)
  .get(getAllConnections); 

router.delete('/:id', protect, authorize('admin', 'user'), validateObjectId('id'), removeConnection);

module.exports = router;
