const router = require('./base.routes')();
const { validate } = require('../middlewares/validation.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const notificationController = require('../app/controllers/notification.controller');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

// All routes require authentication
router.use(authMiddleware);

// Notifications management
router.get('/',
    notificationController.getNotifications
);

router.get('/unread-count',
    notificationController.getUnreadCount
);

router.post('/mark-read',
    notificationController.markAsRead
);

router.post('/mark-all-read',
    notificationController.markAllAsRead
);

router.delete('/:notificationId',
    notificationController.deleteNotification
);

router.delete('/',
    notificationController.clearAllNotifications
);

// Real-time notifications (Server-Sent Events)
router.get('/stream',
    notificationController.subscribe
);

// Statistics
router.get('/stats',
    notificationController.getNotificationStats
);

module.exports = router;