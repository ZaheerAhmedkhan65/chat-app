const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/Users');
require('dotenv').config();

const signup = async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const userId = await User.create(username, hashedPassword);
    res.status(201).redirect('/auth/login');
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate a JWT token with a short expiry time (e.g., 1 hour)
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Set the token in an HTTP-only cookie that expires in 1 week
    res.cookie('token', token, {
      httpOnly: true, // Prevent JavaScript access to the cookie
      secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week expiration time
      sameSite: 'Strict', // Prevent CSRF attacks
    });

    res.redirect('/users/select-receiver');
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Error during login' });
  }
};

const logout = (req, res) => {
  // Clear the token cookie
  res.clearCookie('token');
  res.redirect('/auth/login');
};

module.exports = { signup, login, logout };
