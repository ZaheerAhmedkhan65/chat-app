const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticate = (req, res, next) => {
  // Check for token in query parameters (GET requests) or request body (POST requests)
  const token = req.cookies.token; ;
  if (!token) {
    return res.redirect('/auth/login'); // Redirect to login if no token
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId; // Attach userId to the request
    next();
  } catch (error) {
    console.error('Token verification failed:', error); // Log the error
    res.redirect('/auth/login'); // Redirect to login if token is invalid
  }
};

module.exports = authenticate;