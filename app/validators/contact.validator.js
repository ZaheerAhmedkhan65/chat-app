const { param, query, body } = require('express-validator');

const contactValidators = {
    userIdParam: [
        param('userId')
            .isInt({ min: 1 }).withMessage('Invalid user ID')
    ],

    contactIdParam: [
        param('contactId')
            .isInt({ min: 1 }).withMessage('Invalid contact ID')
    ],

    requestIdParam: [
        param('requestId')
            .isInt({ min: 1 }).withMessage('Invalid request ID')
    ],

    sendContactRequest: [
        body('recipient_id')
            .isInt({ min: 1 }).withMessage('Invalid recipient ID'),
        body('message')
            .optional()
            .isLength({ max: 255 }).withMessage('Message must be less than 255 characters')
    ]
};

module.exports = contactValidators;