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
const { protect, authorize } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validateObjectId');

router.get('/search', searchUsers);

router.route('/')
  .get(getAllUsers) // public
  .post(protect, authorize('admin'), createUser); // only admins can force create nodes directly, normal users use /register

router.delete('/:id', protect, authorize('admin'), validateObjectId('id'), deleteUser);

module.exports = router;
