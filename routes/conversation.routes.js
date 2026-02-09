const router = require('./base.routes')();
const { validate } = require('../middlewares/validation.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const conversationController = require('../app/controllers/conversation.controller');
const conversationValidators = require('../app/validators/conversation.validator');
const messageRoutes = require('./message.routes');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

// All routes require authentication
router.use(authMiddleware);

// Conversations management
router.get('/',
    cacheMiddleware(120), // Cache for 2 minutes
    conversationController.getUserConversations
);

router.post('/direct',
    conversationController.createDirectConversation
);

router.post('/group',
    conversationController.createGroupConversation
);

// Specific conversation operations
router.get('/:conversationId',
    validate(conversationValidators.conversationIdParam),
    cacheMiddleware(120),
    conversationController.getConversation
);

// Message routes (nested)
router.use('/:conversationId/messages', messageRoutes);

// Conversation statistics
router.get('/:conversationId/stats',
    validate(conversationValidators.conversationIdParam),
    conversationController.getConversationStats
);

// Global message operations (not conversation-specific)

// Starred messages across all conversations
router.get('/starred/messages',
    cacheMiddleware(300),
    conversationController.getStarredMessages
);

// Mentioned messages across all conversations
router.get('/mentions/messages',
    cacheMiddleware(180),
    conversationController.getMentionedMessages
);

// Message drafts
router.get('/:conversationId/draft',
    validate(conversationValidators.conversationIdParam),
    conversationController.getDraft
);

router.post('/:conversationId/draft',
    validate(conversationValidators.conversationIdParam),
    conversationController.saveDraft
);

router.delete('/:conversationId/draft',
    validate(conversationValidators.conversationIdParam),
    conversationController.deleteDraft
);

module.exports = router;