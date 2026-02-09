const router = require('./base.routes')();
const { validate } = require('../middlewares/validation.middleware');
const { authMiddleware, optionalAuth } = require('../middlewares/auth.middleware');
const userController = require('../app/controllers/user.controller');
const userValidators = require('../app/validators/user.validator');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

// Protected routes (require authentication)
router.use(authMiddleware);

// Profile routes
router.get('/profile',
  userController.getProfile
);

router.put('/profile',
  validate(userValidators.updateUser),
  userController.updateProfile
);

router.put('/privacy-settings',
  validate(userValidators.updatePrivacySettings),
  userController.updatePrivacySettings
);

router.put('/online-status',
  userController.updateOnlineStatus
);

// User search (publicly accessible with optional auth)
router.get('/search',
  optionalAuth,
  validate(userValidators.getUsers),
  cacheMiddleware(300), // Cache for 5 minutes
  userController.searchUsers
);

router.get('/online',
  optionalAuth,
  cacheMiddleware(60), // Cache for 1 minute
  userController.getOnlineUsers
);

// Get specific user profile
router.get('/:userId',
  optionalAuth,
  validate(userValidators.userIdParam),
  userController.getUserById
);

// User management
router.post('/deactivate',
  userController.deactivateAccount
);

// Cache management
router.post('/cache/warm',
  userController.warmCache
);

// User statistics
router.get('/stats/summary',
  userController.getUserStats
);

module.exports = router;