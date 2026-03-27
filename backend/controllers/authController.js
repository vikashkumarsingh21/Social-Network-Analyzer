/**
 * controllers/authController.js
 * Authentication endpoints
 */
const User = require('../models/User');
const ErrorResponse = require('../utils/ErrorResponse');
const generateToken = require('../utils/generateToken');

/**
 * @desc   Register user
 * @route  POST /api/auth/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Login user
 * @route  POST /api/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return next(new ErrorResponse('Please provide an email and password', 400));
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = generateToken(user._id);

  res.status(statusCode).json({
    success: true,
    message: 'Authentication successful',
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      token
    }
  });
};

module.exports = {
  register,
  login
};
