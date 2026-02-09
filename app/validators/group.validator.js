const { param, query, body } = require('express-validator');

const groupValidators = {
    groupIdParam: [
        param('groupId')
            .isInt({ min: 1 }).withMessage('Invalid group ID')
    ],

    memberIdParam: [
        param('memberId')
            .isInt({ min: 1 }).withMessage('Invalid member ID')
    ],

    createGroup: [
        body('name')
            .trim()
            .notEmpty().withMessage('Group name is required')
            .isLength({ min: 2, max: 100 }).withMessage('Group name must be 2-100 characters'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
        body('avatar_url')
            .optional()
            .trim()
            .isURL().withMessage('Invalid avatar URL'),
        body('is_private')
            .optional()
            .isBoolean().withMessage('is_private must be boolean'),
        body('max_members')
            .optional()
            .isInt({ min: 2, max: 10000 }).withMessage('Max members must be between 2 and 10000')
    ],

    addMember: [
        body('user_id')
            .isInt({ min: 1 }).withMessage('Invalid user ID'),
        body('role')
            .optional()
            .isIn(['admin', 'moderator', 'member']).withMessage('Role must be admin, moderator, or member')
    ],

    changeRole: [
        body('role')
            .isIn(['admin', 'moderator', 'member']).withMessage('Role must be admin, moderator, or member')
    ],

    createInvitation: [
        body('invitee_id')
            .optional()
            .isInt({ min: 1 }).withMessage('Invalid invitee ID'),
        body('invitee_email')
            .optional()
            .isEmail().withMessage('Invalid email format')
            .normalizeEmail(),
        body('expires_at')
            .optional()
            .isISO8601().withMessage('Invalid expiration date')
    ]
};

module.exports = groupValidators;