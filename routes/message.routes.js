const router = require('./base.routes')();
const { validate } = require('../middlewares/validation.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const conversationController = require('../app/controllers/conversation.controller');
const conversationValidators = require('../app/validators/conversation.validator');
const { cacheMiddleware } = require('../middlewares/cache.middleware');

// All routes require authentication
router.use(authMiddleware);

// Message operations (nested under conversation)
router.post('/',
  validate(conversationValidators.sendMessage),
  conversationController.sendMessage
);

// Message search within conversation
router.get('/search',
  conversationController.searchInConversation
);

// Get message thread (replies)
router.get('/thread/:messageId',
  validate(conversationValidators.messageIdParam),
  cacheMiddleware(180),
  conversationController.getMessageThread
);

// Get conversation attachments
router.get('/attachments',
  cacheMiddleware(300),
  conversationController.getAttachments
);

// Mark conversation as read
router.post('/mark-read',
  conversationController.markAllAsRead
);

// Get unread count
router.get('/unread-count',
  conversationController.getUnreadCount
);

// Message operations by ID
router.route('/:messageId')
  .put(
    validate(conversationValidators.messageIdParam),
    conversationController.updateMessage
  )
  .delete(
    validate(conversationValidators.messageIdParam),
    conversationController.deleteMessage
  );

// Message reactions
router.post('/:messageId/reactions',
  validate(conversationValidators.messageIdParam),
  validate(conversationValidators.addReaction),
  conversationController.addReaction
);

router.delete('/:messageId/reactions',
  validate(conversationValidators.messageIdParam),
  conversationController.removeReaction
);

// Mark message as viewed
router.post('/:messageId/view',
  validate(conversationValidators.messageIdParam),
  conversationController.markAsViewed
);

// Star/unstar message
router.post('/:messageId/star',
  validate(conversationValidators.messageIdParam),
  conversationController.starMessage
);

router.delete('/:messageId/star',
  validate(conversationValidators.messageIdParam),
  conversationController.unstarMessage
);

module.exports = router;