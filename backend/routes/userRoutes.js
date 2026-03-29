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
  .post(protect, authorize('admin', 'user'), createUser); // normal users can create nodes via the UI

router.delete('/:id', protect, authorize('admin', 'user'), validateObjectId('id'), deleteUser);

module.exports = router;
