/**
 * middleware/validateObjectId.js
 * Prevent cast errors by pre-validating object IDs in routes
 */
const mongoose = require('mongoose');
const ErrorResponse = require('../utils/ErrorResponse');

const validateObjectId = (paramName) => (req, res, next) => {
  const id = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorResponse(`Invalid ID format for ${paramName}`, 400));
  }
  next();
};

module.exports = { validateObjectId };
