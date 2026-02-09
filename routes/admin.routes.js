const router = require('./base.routes')();
const { validate } = require('../middlewares/validation.middleware');
const { authMiddleware, requireRoles } = require('../middlewares/auth.middleware');
const adminController = require('../app/controllers/admin.controller');
const adminValidators = require('../app/validators/admin.validator');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRoles('admin'));

// Cache management
router.get('/cache/stats',
    adminController.getCacheStats
);

router.post('/cache/clear',
    adminController.clearCache
);

router.post('/cache/warm/user/:userId',
    validate(adminValidators.userIdParam),
    adminController.warmUserCache
);

router.post('/cache/warm/group/:groupId',
    validate(adminValidators.groupIdParam),
    adminController.warmGroupCache
);

// System management
router.get('/system/stats',
    adminController.getSystemStats
);

router.post('/system/cleanup',
    adminController.cleanupOldData
);

// User management
router.get('/users',
    adminController.getUserManagement
);

router.put('/users/:userId/status',
    validate(adminValidators.userIdParam),
    adminController.updateUserStatus
);

module.exports = router;