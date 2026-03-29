/**
 * controllers/userController.js
 * CRUD operations for Users (graph nodes)
 */
const User = require('../models/User');
const Connection = require('../models/Connection');
const ErrorResponse = require('../utils/ErrorResponse');
const { getIO } = require('../utils/socket'); // Real-time emitter
const { clearGraphCache } = require('./graphController');

const createUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return next(new ErrorResponse('Please provide name, email and password', 400));
    }

    const user = await User.create({ name: name.trim(), email, password });
    user.password = undefined;

    clearGraphCache();

    // Emit Real-Time Update
    getIO().emit('graphUpdated', { message: `User ${user.name} joined the network!` });

    res.status(201).json({ success: true, message: 'User created successfully', data: user });
  } catch (error) { next(error); }
};

const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: 'Users retrieved', data: { count: users.length, users } });
  } catch (error) { next(error); }
};

const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return next(new ErrorResponse('Please provide a search query', 400));

    const users = await User.find({ name: { $regex: q, $options: 'i' } }).select('-password -email');
    res.status(200).json({ success: true, message: `Search results for '${q}'`, data: { count: users.length, users } });
  } catch (error) { next(error); }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new ErrorResponse(`User not found`, 404));

    await Connection.deleteMany({ $or: [{ user1: req.params.id }, { user2: req.params.id }] });
    await user.deleteOne();

    clearGraphCache();

    // Emit Real-Time Update
    getIO().emit('graphUpdated', { message: `User ${user.name} left the network.` });

    res.status(200).json({ success: true, message: `User removed.`, data: {} });
  } catch (error) { next(error); }
};

module.exports = { createUser, getAllUsers, searchUsers, deleteUser };
