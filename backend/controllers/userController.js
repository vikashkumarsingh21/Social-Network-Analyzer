/**
 * controllers/userController.js
 * CRUD operations for Users (graph nodes)
 */
const User = require('../models/User');
const Connection = require('../models/Connection');

/**
 * @desc   Create a new user
 * @route  POST /api/users
 */
const createUser = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'User name is required.' });
    }

    // Check for duplicate name
    const exists = await User.findOne({ name: name.trim() });
    if (exists) {
      return res.status(409).json({ success: false, message: `User "${name}" already exists.` });
    }

    const user = await User.create({ name: name.trim() });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get all users
 * @route  GET /api/users
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Delete a user and all their connections
 * @route  DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Remove all connections that involve this user
    await Connection.deleteMany({
      $or: [{ user1: req.params.id }, { user2: req.params.id }],
    });

    await user.deleteOne();
    res.status(200).json({
      success: true,
      message: `User "${user.name}" and their connections have been removed.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createUser, getAllUsers, deleteUser };
