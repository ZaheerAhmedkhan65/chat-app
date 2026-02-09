const router = require('./base.routes')();
const { validate } = require('../middlewares/validation.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const contactController = require('../app/controllers/contact.controller');
const contactValidators = require('../app/validators/contact.validator');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

// All routes require authentication
router.use(authMiddleware);

// Contacts management
router.get('/',
    cacheMiddleware(180), // Cache for 3 minutes
    contactController.getContacts
);

router.post('/',
    contactController.addContact
);

router.get('/blocked',
    cacheMiddleware(300),
    contactController.getBlockedContacts
);

router.get('/favorites',
    cacheMiddleware(180),
    contactController.getFavoriteContacts
);

router.get('/mutual/:userId',
    validate(contactValidators.userIdParam),
    cacheMiddleware(300),
    contactController.getMutualContacts
);

// Specific contact operations
router.put('/:contactId',
    validate(contactValidators.contactIdParam),
    contactController.updateContact
);

router.delete('/:contactId',
    validate(contactValidators.contactIdParam),
    contactController.deleteContact
);

router.post('/:contactId/favorite',
    validate(contactValidators.contactIdParam),
    contactController.toggleFavorite
);

router.post('/:contactId/block',
    validate(contactValidators.contactIdParam),
    contactController.toggleBlock
);

// Contact requests
router.get('/requests',
    contactController.getPendingRequests
);

router.post('/requests',
    contactController.sendContactRequest
);

router.post('/requests/:requestId/accept',
    validate(contactValidators.requestIdParam),
    contactController.acceptContactRequest
);

router.post('/requests/:requestId/reject',
    validate(contactValidators.requestIdParam),
    contactController.rejectContactRequest
);

// Statistics and cache
router.get('/stats/summary',
    contactController.getContactStats
);

router.post('/cache/warm',
    contactController.warmContactCache
);

module.exports = router;