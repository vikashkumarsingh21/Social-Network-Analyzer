/**
 * controllers/graphController.js
 * Advanced Graph analysis: BFS shortest path, degree centrality,
 * mutual friends, caching, and connection management.
 */
const User = require('../models/User');
const Connection = require('../models/Connection');
const ErrorResponse = require('../utils/ErrorResponse');
const NodeCache = require('node-cache');

// Cache instance (TTL 10 mins)
const cache = new NodeCache({ stdTTL: 600 });

// Helper to invalidate cache when graph changes
const clearGraphCache = () => {
  cache.del('graphData');
  cache.del('graphStats');
};

/* ────────────────────────────────────────────
   CONNECTION MANAGEMENT
──────────────────────────────────────────── */

/**
 * @desc   Add a connection between two users (undirected edge)
 * @route  POST /api/connections
 * @access Private
 */
const addConnection = async (req, res, next) => {
  try {
    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      return next(new ErrorResponse('Please provide user1 and user2', 400));
    }

    if (user1 === user2) {
      return next(new ErrorResponse('A user cannot connect to themselves', 400));
    }

    // Ensure both users exist
    const [u1, u2] = await Promise.all([User.findById(user1), User.findById(user2)]);
    if (!u1 || !u2) {
      return next(new ErrorResponse('One or both users not found', 404));
    }

    // Normalise order to prevent duplicates (smaller id always goes first)
    const [minId, maxId] = [user1.toString(), user2.toString()].sort();

    // Check for existing connection
    const existing = await Connection.findOne({ user1: minId, user2: maxId });
    if (existing) {
      return next(new ErrorResponse('Connection already exists', 409));
    }

    const connection = await Connection.create({ user1: minId, user2: maxId });
    const populated = await connection.populate(['user1', 'user2']);

    clearGraphCache();

    res.status(201).json({ 
      success: true, 
      message: 'Connection added successfully',
      data: populated 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all connections (edges), populated with user names
 * @route  GET /api/connections
 * @access Public
 */
const getAllConnections = async (req, res, next) => {
  try {
    const connections = await Connection.find()
      .populate('user1', 'name')
      .populate('user2', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ 
      success: true, 
      message: 'Connections retrieved successfully',
      data: {
        count: connections.length, 
        connections 
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Remove a connection
 * @route  DELETE /api/connections/:id
 * @access Private
 */
const removeConnection = async (req, res, next) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection) {
      return next(new ErrorResponse('Connection not found', 404));
    }

    await connection.deleteOne();
    clearGraphCache();

    res.status(200).json({
      success: true,
      message: 'Connection removed successfully',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/* ────────────────────────────────────────────
   ADVANCED GRAPH ALGORITHMS
──────────────────────────────────────────── */

/**
 * @desc   Graph Statistics API
 * @route  GET /api/connections/stats
 * @access Public
 */
const getGraphStats = async (req, res, next) => {
  try {
    // Check cache
    const cachedStats = cache.get('graphStats');
    if (cachedStats) {
      return res.status(200).json({ success: true, message: 'Graph stats retrieved (cached)', data: cachedStats });
    }

    const [userCount, connectionCount] = await Promise.all([
      User.countDocuments(),
      Connection.countDocuments()
    ]);

    const avgDegree = userCount > 0 ? ((2 * connectionCount) / userCount).toFixed(2) : 0;
    const density = userCount > 1 
      ? ((2 * connectionCount) / (userCount * (userCount - 1))).toFixed(4) 
      : 0;

    const stats = {
      totalUsers: userCount,
      totalConnections: connectionCount,
      averageDegree: parseFloat(avgDegree),
      density: parseFloat(density)
    };

    cache.set('graphStats', stats);

    res.status(200).json({
      success: true,
      message: 'Graph stats retrieved',
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Shortest Path (BFS) between two users
 * @route  GET /api/connections/path/:user1/:user2
 * @access Public
 */
const getShortestPath = async (req, res, next) => {
  try {
    const { user1, user2 } = req.params;

    if (user1 === user2) {
      return res.status(200).json({ 
        success: true, 
        message: 'Path found',
        data: { path: [user1], distance: 0 } 
      });
    }

    // Build Adjacency List
    const connections = await Connection.find().lean();
    const adj = new Map();

    connections.forEach(({ user1: u1, user2: u2 }) => {
      const a = u1.toString();
      const b = u2.toString();
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    });

    if (!adj.has(user1) || !adj.has(user2)) {
      return next(new ErrorResponse('One or both users have no connections', 404));
    }

    // BFS Queue: stores [currentNode, currentPathArray]
    const queue = [[user1, [user1]]];
    const visited = new Set([user1]);

    while (queue.length > 0) {
      const [curr, path] = queue.shift();

      if (curr === user2) {
        // Resolve names for the path
        const usersInPath = await User.find({ _id: { $in: path } }, 'name');
        const nameMap = new Map(usersInPath.map(u => [u._id.toString(), u.name]));
        
        const pathWithNames = path.map(id => ({ id, name: nameMap.get(id) || id }));

        return res.status(200).json({
          success: true,
          message: 'Shortest path found',
          data: {
            distance: path.length - 1,
            path: pathWithNames
          }
        });
      }

      const neighbors = adj.get(curr) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([neighbor, [...path, neighbor]]);
        }
      }
    }

    res.status(404).json({
      success: false,
      message: 'No path exists between these users',
      data: null
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Find mutual friends between a given user and all others
 * @route  GET /api/connections/mutual/:id
 * @access Public
 */
const getMutualFriends = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Use fast lean queries
    const allConnections = await Connection.find().lean();
    
    // adjacency: Map<userId_string, Set<userId_string>>
    const adj = new Map();

    allConnections.forEach(({ user1, user2 }) => {
      const a = user1.toString();
      const b = user2.toString();
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a).add(b);
      adj.get(b).add(a);
    });

    const targetFriends = adj.get(targetId) ?? new Set();
    const allUsers = await User.find({ _id: { $ne: targetId } }, 'name _id').lean();

    const results = [];

    for (const user of allUsers) {
      const uid = user._id.toString();
      const userFriends = adj.get(uid) ?? new Set();

      // Mutual = intersection of targetFriends and userFriends
      const mutual = [];
      for (const f of targetFriends) {
        if (userFriends.has(f)) mutual.push(f);
      }

      if (mutual.length > 0) {
        results.push({
          otherUser: { _id: user._id, name: user.name },
          mutualFriendIds: mutual,
          count: mutual.length,
        });
      }
    }

    // Sort by mutual count descending
    results.sort((a, b) => b.count - a.count);

    // Populate mutual friend names for the top results efficiently
    const userDict = new Map(allUsers.map(u => [u._id.toString(), u.name]));
    userDict.set(targetId, targetUser.name); // Include target user just in case

    const populatedResults = results.map(r => ({
      otherUser: r.otherUser,
      count: r.count,
      mutualFriends: r.mutualFriendIds.map(id => ({ _id: id, name: userDict.get(id) || 'Unknown' }))
    }));

    res.status(200).json({ 
      success: true, 
      message: `Mutual friends calculated for ${targetUser.name}`,
      data: {
        targetUser: targetUser.name,
        results: populatedResults 
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Detect top influencer(s) by degree centrality
 * @route  GET /api/connections/influencer
 * @access Public
 */
const getInfluencer = async (req, res, next) => {
  try {
    const allConnections = await Connection.find().lean();
    const users = await User.find({}, 'name _id').lean();

    // Count degree for each user (in-memory optimized)
    const degreeMap = new Map();
    users.forEach(u => degreeMap.set(u._id.toString(), 0));

    allConnections.forEach(({ user1, user2 }) => {
      const a = user1.toString();
      const b = user2.toString();
      degreeMap.set(a, (degreeMap.get(a) || 0) + 1);
      degreeMap.set(b, (degreeMap.get(b) || 0) + 1);
    });

    // Build sorted ranking
    let ranking = users.map(u => ({
      _id: u._id,
      name: u.name,
      degree: degreeMap.get(u._id.toString()) || 0,
    }));
    
    ranking.sort((a, b) => b.degree - a.degree);

    // Rank assignment
    ranking = ranking.map((r, i) => ({ rank: i + 1, ...r }));

    res.status(200).json({
      success: true,
      message: 'Influencer ranking generated',
      data: {
        topInfluencer: ranking[0] || null,
        top3: ranking.slice(0, 3),
        fullRanking: ranking,
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Return full graph data (nodes + edges) for D3.js visualisation
 * @route  GET /api/connections/graph
 * @access Public
 */
const getGraphData = async (req, res, next) => {
  try {
    // Check cache
    const cachedData = cache.get('graphData');
    if (cachedData) {
      return res.status(200).json({ success: true, message: 'Graph data retrieved (cached)', data: cachedData });
    }

    const [users, connections] = await Promise.all([
      User.find({}, 'name _id createdAt').lean(),
      Connection.find().populate('user1', 'name').populate('user2', 'name').lean(),
    ]);

    // Compute degree for each node
    const degreeMap = new Map();
    users.forEach(u => degreeMap.set(u._id.toString(), 0));
    connections.forEach(({ user1, user2 }) => {
      const a = user1._id.toString();
      const b = user2._id.toString();
      degreeMap.set(a, (degreeMap.get(a) || 0) + 1);
      degreeMap.set(b, (degreeMap.get(b) || 0) + 1);
    });

    const nodes = users.map(u => ({
      id:         u._id.toString(),
      name:       u.name,
      degree:     degreeMap.get(u._id.toString()) || 0,
      createdAt:  u.createdAt,
    }));

    const edges = connections.map(c => ({
      id:         c._id.toString(),
      source:     c.user1._id.toString(),
      target:     c.user2._id.toString(),
      sourceName: c.user1.name,
      targetName: c.user2.name,
    }));

    const resultData = {
      totalUsers: nodes.length,
      totalConnections: edges.length,
      nodes,
      edges,
    };

    cache.set('graphData', resultData);

    res.status(200).json({
      success: true,
      message: 'Graph data retrieved',
      data: resultData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  addConnection, 
  getAllConnections, 
  removeConnection,
  getGraphStats,
  getShortestPath,
  getMutualFriends, 
  getInfluencer, 
  getGraphData 
};
