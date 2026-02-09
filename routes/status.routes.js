const router = require('./base.routes')();
const { validate } = require('../middlewares/validation.middleware');
const { authMiddleware, optionalAuth } = require('../middlewares/auth.middleware');
const statusController = require('../app/controllers/status.controller');
const statusValidators = require('../app/validators/status.validator');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

// All routes require authentication except viewing specific status
router.use(authMiddleware);

// Status management
router.get('/',
    cacheMiddleware(60), // Cache for 1 minute
    statusController.getUserStatuses
);

router.post('/',
    statusController.createStatus
);

router.get('/contacts',
    cacheMiddleware(60),
    statusController.getContactStatuses
);

router.get('/popular',
    cacheMiddleware(300),
    statusController.getPopularStatuses
);

router.get('/search',
    cacheMiddleware(180),
    statusController.searchStatuses
);

// Specific status operations
router.get('/:statusId',
    validate(statusValidators.statusIdParam),
    optionalAuth, // Allow viewing statuses without auth if shared publicly
    statusController.getStatus
);

router.put('/:statusId',
    validate(statusValidators.statusIdParam),
    statusController.updateStatus
);

router.delete('/:statusId',
    validate(statusValidators.statusIdParam),
    statusController.deleteStatus
);

router.post('/:statusId/archive',
    validate(statusValidators.statusIdParam),
    statusController.archiveStatus
);

// Status views
router.get('/:statusId/views',
    validate(statusValidators.statusIdParam),
    statusController.getStatusViews
);

router.get('/:statusId/view-history',
    validate(statusValidators.statusIdParam),
    statusController.getViewHistory
);

router.get('/recent-viewers',
    statusController.getRecentViewers
);

// Statistics and insights
router.get('/stats/insights',
    statusController.getStatusInsights
);

router.get('/:statusId/stats',
    validate(statusValidators.statusIdParam),
    statusController.getStatusStats
);

// Admin cleanup
router.post('/cleanup/expired',
    statusController.cleanupExpiredStatuses
);

module.exports = router;