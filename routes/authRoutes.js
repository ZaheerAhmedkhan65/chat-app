const express = require('express');
const { signup, login, logout } = require('../controllers/authController');

const router = express.Router();

// Render signup page
router.get('/signup', (req, res) => {
  res.render('signup');
});

// Handle signup form submission
router.post('/signup', signup);

// Render login page
router.get('/login', (req, res) => {
  res.render('login');
});

// Handle login form submission
router.post('/login', login);

// Render logout page
router.get('/logout', logout);

module.exports = router;