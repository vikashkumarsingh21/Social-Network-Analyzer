/**
 * routes/userRoutes.js
 * Express router for User endpoints
 */
const express = require('express');
const router = express.Router();

const { 
  createUser, 
  getAllUsers, 
  searchUsers,
  deleteUser 
} = require('../controllers/userController');
const { validateObjectId } = require('../middleware/validateObjectId');

// Search route must be defined before /:id routes
router.get('/search', searchUsers);

// GET  /api/users      — get all users
// POST /api/users      — create a new user (Unprotected for frontend integration)
router.route('/')
  .get(getAllUsers)
  .post(createUser);

// DELETE /api/users/:id — delete user + their connections (Unprotected for frontend integration)
router.delete('/:id', validateObjectId('id'), deleteUser);

module.exports = router;
