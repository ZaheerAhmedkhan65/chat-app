// app/routes/base.routes.js
const express = require('express');

module.exports = () => {
    const router = express.Router();

    // Add common middleware to all routes
    router.use((req, res, next) => {
        // Set default response headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');

        // Add request ID for tracking
        req.requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        next();
    });

    return router;
};