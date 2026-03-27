/**
 * models/User.js
 * Mongoose schema & model for a network user (graph node)
 */
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      unique: true,
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model('User', UserSchema);
