const router = require('./base.routes')();
const { validate } = require('../middlewares/validation.middleware');
const { authMiddleware, optionalAuth } = require('../middlewares/auth.middleware');
const authController = require('../app/controllers/auth.controller');
const userValidators = require('../app/validators/user.validator');

// Public routes
router.post('/register',
  validate(userValidators.createUser),
  authController.register
);

router.post('/login',
  authController.login
);

router.post('/refresh-token',
  authController.refreshToken
);

router.post('/forgot-password',
  authController.forgotPassword
);

router.post('/reset-password',
  authController.resetPassword
);

router.get('/verify-email/:token',
  authController.verifyEmail
);

// Protected routes
router.post('/logout',
  authMiddleware,
  authController.logout
);

router.post('/change-password',
  authMiddleware,
  validate(userValidators.changePassword),
  authController.changePassword
);

router.get('/me',
  authMiddleware,
  authController.getCurrentUser
);

module.exports = router;