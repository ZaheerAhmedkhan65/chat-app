//app/routes/application.routes.js
const fs = require('fs');
const path = require('path');
const { authMiddleware, optionalAuth, requireRoles } = require('../middlewares/auth.middleware');
console.log('\n📁 Loading routes...');
// Define public routes (no authentication required)
const publicRoutes = ['auth', 'public'];

// Define route mounts for specific paths
const routeMounts = {
    auth: '/auth',
    admin: '/admin',
    public: '/',
    api: '/api'
};

// Define route-specific middlewares
const routeMiddlewares = {
    admin: [authMiddleware, requireRoles('admin')],
    api: [authMiddleware]
};

module.exports = (app) => {
    const routesPath = path.join(__dirname);
    const routeFiles = fs.readdirSync(routesPath).filter(f => f.endsWith('.routes.js') && f !== 'app.routes.js');

    routeFiles.forEach(file => {
        const route = require(path.join(routesPath, file));
        const routeName = file.replace('.routes.js', '').toLowerCase();
        const routePath = routeMounts[routeName] || `/${routeName}`;

        // Apply middlewares based on route type
        if (publicRoutes.includes(routeName)) {
            app.use(routePath, route);
        } else if (routeMiddlewares[routeName]) {
            app.use(routePath, ...routeMiddlewares[routeName], route);
        } else {
            app.use(routePath, authMiddleware, route);
        }
        console.log(`✅ ${routePath}`);
    });

    console.log('✅ All routes loaded successfully!\n');

    // 404 handler for API routes
    app.use('/api', (req, res) => {
        res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    });


    // 404 handler for web routes
    // app.use('*', (req, res) => {
    //     if (req.xhr || req.headers.accept?.includes('application/json')) {
    //         return res.status(404).json({
    //             success: false,
    //             message: 'Endpoint not found'
    //         });
    //     }

    //     res.status(404).render('error/404', {
    //         title: 'Page Not Found',
    //         message: 'The page you are looking for does not exist.'
    //     });
    // });
};

// const express = require('express');
// const router = express.Router();

// // Import all route files
// const authRoutes = require('./auth.routes');
// const userRoutes = require('./user.routes');
// const contactRoutes = require('./contact.routes');
// const groupRoutes = require('./group.routes');
// const conversationRoutes = require('./conversation.routes');
// const notificationRoutes = require('./notification.routes');
// const adminRoutes = require('./admin.routes');

// // Use routes
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);
// router.use('/contacts', contactRoutes);
// router.use('/groups', groupRoutes);
// router.use('/conversations', conversationRoutes);
// router.use('/notifications', notificationRoutes);
// router.use('/admin', adminRoutes);

// module.exports = router;