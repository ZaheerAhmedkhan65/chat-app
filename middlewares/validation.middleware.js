const { validationResult } = require('express-validator');
const { ValidationError } = require('../app/utils/error');

const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        const extractedErrors = errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
        }));

        throw new ValidationError('Validation failed', extractedErrors);
    };
};

const validateBody = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const extractedErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context.value
            }));

            throw new ValidationError('Validation failed', extractedErrors);
        }

        next();
    };
};

module.exports = {
    validate,
    validateBody
};