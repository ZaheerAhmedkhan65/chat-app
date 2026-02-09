const { param, query, body } = require('express-validator');

const conversationValidators = {
    conversationIdParam: [
        param('conversationId')
            .isInt({ min: 1 }).withMessage('Invalid conversation ID')
    ],

    messageIdParam: [
        param('messageId')
            .isInt({ min: 1 }).withMessage('Invalid message ID')
    ],

    createDirectConversation: [
        body('other_user_id')
            .isInt({ min: 1 }).withMessage('Invalid user ID')
    ],

    createGroupConversation: [
        body('group_id')
            .isInt({ min: 1 }).withMessage('Invalid group ID')
    ],

    sendMessage: [
        body('content')
            .optional()
            .isLength({ max: 5000 }).withMessage('Content must be less than 5000 characters'),
        body('message_type')
            .optional()
            .isIn(['text', 'image', 'video', 'audio', 'file', 'location', 'contact'])
            .withMessage('Invalid message type'),
        body('attachment_url')
            .optional()
            .trim()
            .isURL().withMessage('Invalid attachment URL'),
        body('parent_message_id')
            .optional()
            .isInt({ min: 1 }).withMessage('Invalid parent message ID'),
        body('mentions')
            .optional()
            .custom(value => {
                try {
                    if (typeof value === 'string') {
                        const parsed = JSON.parse(value);
                        if (!Array.isArray(parsed)) {
                            throw new Error('Mentions must be an array');
                        }
                        parsed.forEach(id => {
                            if (!Number.isInteger(id) || id < 1) {
                                throw new Error('Invalid user ID in mentions');
                            }
                        });
                    }
                    return true;
                } catch {
                    throw new Error('Invalid mentions format');
                }
            })
    ],

    updateMessage: [
        body('content')
            .notEmpty().withMessage('Content is required')
            .isLength({ max: 5000 }).withMessage('Content must be less than 5000 characters')
    ],

    addReaction: [
        body('reaction')
            .trim()
            .notEmpty().withMessage('Reaction is required')
            .isLength({ max: 10 }).withMessage('Reaction must be less than 10 characters')
    ],

    getMessages: [
        query('before_id')
            .optional()
            .isInt({ min: 1 }).withMessage('Invalid before_id'),
        query('after_id')
            .optional()
            .isInt({ min: 1 }).withMessage('Invalid after_id'),
        query('sender_id')
            .optional()
            .isInt({ min: 1 }).withMessage('Invalid sender_id'),
        query('message_type')
            .optional()
            .isIn(['text', 'image', 'video', 'audio', 'file', 'location', 'contact'])
            .withMessage('Invalid message type'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('page')
            .optional()
            .isInt({ min: 1 }).withMessage('Page must be at least 1')
    ]
};

module.exports = conversationValidators;