/**
 * controllers/userController.js
 * CRUD operations for Users (graph nodes)
 */
const User = require('../models/User');
const Connection = require('../models/Connection');
const ErrorResponse = require('../utils/ErrorResponse');

/**
 * @desc   Create a new user (admin/system override if needed)
 * @route  POST /api/users
 * @access Private
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return next(new ErrorResponse('Please provide name, email and password', 400));
    }

    const user = await User.create({ name: name.trim(), email, password });
    
    // Don't return password
    user.password = undefined;

    res.status(201).json({ 
      success: true, 
      message: 'User created successfully',
      data: user 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all users
 * @route  GET /api/users
 * @access Public/Private depending on needs
 */
const getAllUsers = async (req, res, next) => {
  try {
    // Return users without password and email by default for graph public views
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.status(200).json({ 
      success: true, 
      message: 'Users retrieved successfully',
      data: {
        count: users.length,
        users
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Search users by name
 * @route  GET /api/users/search?q=name
 * @access Public
 */
const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return next(new ErrorResponse('Please provide a search query', 400));
    }

    // Case-insensitive regex search on name
    const users = await User.find({ 
      name: { $regex: q, $options: 'i' } 
    }).select('-password -email');

    res.status(200).json({
      success: true,
      message: `Search results for '${q}'`,
      data: {
        count: users.length,
        users
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete a user and all their connections
 * @route  DELETE /api/users/:id
 * @access Private
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }

    // Remove all connections that involve this user
    await Connection.deleteMany({
      $or: [{ user1: req.params.id }, { user2: req.params.id }],
    });

    await user.deleteOne();
    
    res.status(200).json({
      success: true,
      message: `User "${user.name}" and their connections have been removed.`,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createUser, getAllUsers, searchUsers, deleteUser };
