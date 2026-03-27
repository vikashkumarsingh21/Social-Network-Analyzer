/**
 * middleware/auth.js
 * Protect routes by verifying JWT token
 */
const jwt = require('jsonwebtoken');
const ErrorResponse = require('../utils/ErrorResponse');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const secret = process.env.JWT_SECRET || 'fallback_dev_secret_jwt';
    const decoded = jwt.verify(token, secret);

    // Get user from the token payload and attach to req
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return next(new ErrorResponse('No user found with this id', 404));
    }

    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
};

module.exports = { protect };
