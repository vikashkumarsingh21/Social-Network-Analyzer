/**
 * utils/generateToken.js
 * Helper to generate JWT token based on user ID
 */
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  // Using a fallback secret for development if env is not set
  const secret = process.env.JWT_SECRET || 'fallback_dev_secret_jwt';
  return jwt.sign({ id }, secret, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

module.exports = generateToken;
