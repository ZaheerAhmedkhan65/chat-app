const { param, query, body } = require('express-validator');

const statusValidators = {
    statusIdParam: [
        param('statusId')
            .isInt({ min: 1 }).withMessage('Invalid status ID')
    ],

    createStatus: [
        body('type')
            .isIn(['text', 'image', 'video']).withMessage('Type must be text, image, or video'),
        body('content')
            .optional()
            .isLength({ max: 1000 }).withMessage('Content must be less than 1000 characters'),
        body('media_url')
            .optional()
            .trim()
            .isURL().withMessage('Invalid media URL'),
        body('background_color')
            .optional()
            .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
            .withMessage('Invalid background color (hex format)'),
        body('text_color')
            .optional()
            .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
            .withMessage('Invalid text color (hex format)'),
        body('font_style')
            .optional()
            .isLength({ max: 50 }).withMessage('Font style must be less than 50 characters'),
        body('expires_in_hours')
            .optional()
            .isInt({ min: 1, max: 168 }).withMessage('Expiration must be between 1 and 168 hours (1 week)')
    ],

    searchStatuses: [
        query('search')
            .optional()
            .trim()
            .isLength({ min: 2, max: 100 }).withMessage('Search term must be 2-100 characters')
    ],

    getViewHistory: [
        query('days')
            .optional()
            .isInt({ min: 1, max: 30 }).withMessage('Days must be between 1 and 30')
    ]
};

module.exports = statusValidators;