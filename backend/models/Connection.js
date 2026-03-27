/**
 * models/Connection.js
 * Mongoose schema & model for a connection between two users (graph edge)
 * Connections are undirected: user1 <-> user2
 */
const mongoose = require('mongoose');

const ConnectionSchema = new mongoose.Schema(
  {
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate connections in both directions
// e.g. user1->user2 and user2->user1 are the same edge
ConnectionSchema.index({ user1: 1, user2: 1 }, { unique: true });

module.exports = mongoose.model('Connection', ConnectionSchema);
