const { param, body } = require('express-validator');

const adminValidators = {
    userIdParam: [
        param('userId')
            .isInt({ min: 1 }).withMessage('Invalid user ID')
    ],

    groupIdParam: [
        param('groupId')
            .isInt({ min: 1 }).withMessage('Invalid group ID')
    ],

    clearCache: [
        body('pattern')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('Pattern must be less than 100 characters')
    ],

    updateUserStatus: [
        body('is_active')
            .optional()
            .isBoolean().withMessage('is_active must be boolean'),
        body('role')
            .optional()
            .isIn(['user', 'admin', 'moderator']).withMessage('Invalid role')
    ],

    cleanupData: [
        body('days')
            .optional()
            .isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
    ]
};

module.exports = adminValidators;