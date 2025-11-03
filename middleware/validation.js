const { body, param, query, validationResult } = require('express-validator');

// Phone number validation helper
function validatePhoneNumber(phone) {
    if (!phone) return { valid: false, error: 'Phone number is required' };
    
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Check length (10-15 digits)
    if (cleaned.length < 10 || cleaned.length > 15) {
        return { valid: false, error: 'Invalid phone length (must be 10-15 digits)' };
    }
    
    // Normalize format
    let normalized;
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
        // Indian mobile number
        normalized = `+91${cleaned}`;
    } else if (cleaned.length > 10) {
        // International format
        normalized = `+${cleaned}`;
    } else {
        return { valid: false, error: 'Invalid phone format' };
    }
    
    return { valid: true, normalized };
}

// Validation for pagination
const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1, max: 10000 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

// Validation for UUID parameters
const uuidValidation = [
    param('id')
        .isUUID()
        .withMessage('Invalid ID format')
];

// Middleware to handle validation errors
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.param,
                message: err.msg,
                value: err.value
            }))
        });
    }
    
    next();
}

module.exports = {
    paginationValidation,
    uuidValidation,
    handleValidationErrors,
    validatePhoneNumber
};
