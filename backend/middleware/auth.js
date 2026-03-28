/**
 * middleware/auth.js
 * Protect routes by verifying JWT token & Role authorization
 */
const jwt = require('jsonwebtoken');
const ErrorResponse = require('../utils/ErrorResponse');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return next(new ErrorResponse('Not authorized to access this route', 401));

  try {
    const secret = process.env.JWT_SECRET || 'fallback_dev_secret_jwt';
    const decoded = jwt.verify(token, secret);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return next(new ErrorResponse('User not found', 404));
    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ErrorResponse(`User role ${req.user.role} is not authorized`, 403));
    }
    next();
  };
};

module.exports = { protect, authorize };
