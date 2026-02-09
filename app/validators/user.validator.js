const { body, param, query } = require('express-validator');
const { ValidationError } = require('../utils/error');

const userValidators = {
    createUser: [
        body('name')
            .trim()
            .notEmpty().withMessage('Name is required')
            .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email format')
            .normalizeEmail(),
        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('phone')
            .optional()
            .trim()
            .matches(/^[+]?[\d\s\-()]+$/).withMessage('Invalid phone number'),
        body('about')
            .optional()
            .trim()
            .isLength({ max: 500 }).withMessage('About must be less than 500 characters')
    ],

    updateUser: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
        body('email')
            .optional()
            .trim()
            .isEmail().withMessage('Invalid email format')
            .normalizeEmail(),
        body('phone')
            .optional()
            .trim()
            .matches(/^[+]?[\d\s\-()]+$/).withMessage('Invalid phone number'),
        body('about')
            .optional()
            .trim()
            .isLength({ max: 500 }).withMessage('About must be less than 500 characters'),
        body('avatar_url')
            .optional()
            .trim()
            .isURL().withMessage('Invalid avatar URL'),
        body('status_emoji')
            .optional()
            .trim()
            .isLength({ max: 10 }).withMessage('Status emoji must be less than 10 characters'),
        body('status_text')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('Status text must be less than 100 characters'),
        body('privacy_settings')
            .optional()
            .custom(value => {
                try {
                    if (typeof value === 'string') {
                        JSON.parse(value);
                    }
                    return true;
                } catch {
                    throw new Error('Invalid privacy settings format');
                }
            })
    ],

    updatePrivacySettings: [
        body('show_online_status')
            .optional()
            .isIn(['everyone', 'contacts', 'nobody']).withMessage('Invalid value for show_online_status'),
        body('show_last_seen')
            .optional()
            .isIn(['everyone', 'contacts', 'nobody']).withMessage('Invalid value for show_last_seen'),
        body('show_read_receipts')
            .optional()
            .isBoolean().withMessage('show_read_receipts must be boolean'),
        body('profile_photo_visibility')
            .optional()
            .isIn(['everyone', 'contacts', 'nobody']).withMessage('Invalid value for profile_photo_visibility'),
        body('about_visibility')
            .optional()
            .isIn(['everyone', 'contacts', 'nobody']).withMessage('Invalid value for about_visibility'),
        body('status_visibility')
            .optional()
            .isIn(['everyone', 'contacts', 'nobody']).withMessage('Invalid value for status_visibility'),
        body('who_can_add_to_groups')
            .optional()
            .isIn(['everyone', 'contacts', 'nobody']).withMessage('Invalid value for who_can_add_to_groups'),
        body('who_can_message_me')
            .optional()
            .isIn(['everyone', 'contacts', 'nobody']).withMessage('Invalid value for who_can_message_me'),
        body('require_message_request')
            .optional()
            .isBoolean().withMessage('require_message_request must be boolean')
    ],

    getUsers: [
        query('search')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('Search term too long'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('offset')
            .optional()
            .isInt({ min: 0 }).withMessage('Offset must be a positive integer')
    ],

    userIdParam: [
        param('userId')
            .isInt({ min: 1 }).withMessage('Invalid user ID')
    ],

    changePassword: [
        body('current_password')
            .notEmpty().withMessage('Current password is required'),
        body('new_password')
            .notEmpty().withMessage('New password is required')
            .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
            .custom((value, { req }) => {
                if (value === req.body.current_password) {
                    throw new Error('New password must be different from current password');
                }
                return true;
            })
    ]
};

module.exports = userValidators;