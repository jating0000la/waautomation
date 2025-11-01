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

// Validation rules for template creation/update
const templateValidation = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Template name must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\-_]+$/)
        .withMessage('Template name can only contain letters, numbers, spaces, hyphens, and underscores'),
    
    body('category')
        .isIn(['marketing', 'promotional', 'transactional', 'reminder', 'notification'])
        .withMessage('Invalid category'),
    
    body('body')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Template body must be between 1 and 5000 characters'),
    
    body('mediaUrl')
        .optional({ nullable: true, checkFalsy: true })
        .isURL({ protocols: ['http', 'https'] })
        .withMessage('Media URL must be a valid HTTP/HTTPS URL')
        .isLength({ max: 500 })
        .withMessage('Media URL too long'),
    
    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),
    
    body('tags.*')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Each tag must be between 1 and 50 characters')
];

// Validation for template preview
const previewValidation = [
    body('body')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Preview body must be between 1 and 5000 characters'),
    
    body('sampleData')
        .optional()
        .isObject()
        .withMessage('Sample data must be an object')
];

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

// Validation for audience/contact operations
const audienceValidation = [
    body('phone')
        .custom((value) => {
            const result = validatePhoneNumber(value);
            if (!result.valid) {
                throw new Error(result.error);
            }
            return true;
        }),
    
    body('name')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Name must be less than 200 characters'),
    
    body('consentStatus')
        .optional()
        .isIn(['opted_in', 'unknown', 'opted_out'])
        .withMessage('Invalid consent status'),
    
    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),
    
    body('tags.*')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Each tag must be between 1 and 50 characters')
];

// Validation for DND operations
const dndValidation = [
    body('phone')
        .custom((value) => {
            const result = validatePhoneNumber(value);
            if (!result.valid) {
                throw new Error(result.error);
            }
            return true;
        }),
    
    body('reason')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Reason must be less than 500 characters')
];

// Validation for CSV/paste import
const importValidation = [
    body('audienceId')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Audience ID must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Audience ID can only contain letters, numbers, hyphens, and underscores'),
    
    body('columnMapping')
        .isObject()
        .withMessage('Column mapping must be an object'),
    
    body('columnMapping.phone')
        .notEmpty()
        .withMessage('Phone column mapping is required')
];

// Validation for campaign creation/update
const campaignValidation = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Campaign name must be between 1 and 100 characters')
        .escape(),
    
    body('templateId')
        .isUUID()
        .withMessage('Invalid template ID format'),
    
    body('audienceId')
        .isIn(['main_list', 'all_contacts', 'vip_customers', 'new_subscribers', 'promotional'])
        .withMessage('Invalid audience segment'),
    
    body('scheduledTime')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage('Invalid scheduled time format')
        .custom((value) => {
            if (value && new Date(value) <= new Date()) {
                throw new Error('Scheduled time must be in the future');
            }
            return true;
        }),
    
    body('rateLimit')
        .optional()
        .isInt({ min: 1, max: 20 })
        .withMessage('Rate limit must be between 1-20 messages per minute'),
    
    body('description')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters')
        .escape()
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

// Sanitization middleware
function sanitizeInputs(req, res, next) {
    // Remove any null bytes from all string inputs
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj.replace(/\0/g, '');
        } else if (Array.isArray(obj)) {
            return obj.map(sanitize);
        } else if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                sanitized[key] = sanitize(obj[key]);
            }
            return sanitized;
        }
        return obj;
    };
    
    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);
    
    next();
}

// Validation rules for system settings
const settingsValidation = [
    body('messagesPerMinute')
        .optional()
        .isInt({ min: 1, max: 60 })
        .withMessage('Messages per minute must be between 1 and 60'),
    
    body('messagesPerHour')
        .optional()
        .isInt({ min: 1, max: 3600 })
        .withMessage('Messages per hour must be between 1 and 3600'),
    
    body('messagesPerDay')
        .optional()
        .isInt({ min: 1, max: 50000 })
        .withMessage('Messages per day must be between 1 and 50000'),
    
    body('warmupMode')
        .optional()
        .isBoolean()
        .withMessage('Warmup mode must be a boolean'),
    
    body('warmupLimit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Warmup limit must be between 1 and 1000'),
    
    body('minDelay')
        .optional()
        .isInt({ min: 1000, max: 60000 })
        .withMessage('Minimum delay must be between 1000 and 60000 milliseconds'),
    
    body('maxDelay')
        .optional()
        .isInt({ min: 1000, max: 120000 })
        .withMessage('Maximum delay must be between 1000 and 120000 milliseconds'),
    
    body('delayVariance')
        .optional()
        .isFloat({ min: 0, max: 1 })
        .withMessage('Delay variance must be between 0 and 1'),
    
    body('enableWorkingHours')
        .optional()
        .isBoolean()
        .withMessage('Enable working hours must be a boolean'),
    
    body('workingHoursStart')
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Working hours start must be in HH:MM format'),
    
    body('workingHoursEnd')
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Working hours end must be in HH:MM format'),
    
    body('maxRetries')
        .optional()
        .isInt({ min: 0, max: 10 })
        .withMessage('Max retries must be between 0 and 10'),
    
    body('retryDelay')
        .optional()
        .isInt({ min: 1000, max: 3600000 })
        .withMessage('Retry delay must be between 1000 and 3600000 milliseconds'),
    
    body('webhookUrl')
        .optional({ nullable: true, checkFalsy: true })
        .isURL({ protocols: ['http', 'https'] })
        .withMessage('Webhook URL must be a valid HTTP/HTTPS URL'),
    
    body('webhookSecret')
        .optional({ nullable: true, checkFalsy: true })
        .isLength({ min: 10, max: 100 })
        .withMessage('Webhook secret must be between 10 and 100 characters'),
    
    body('debugMode')
        .optional()
        .isBoolean()
        .withMessage('Debug mode must be a boolean')
];

module.exports = {
    templateValidation,
    previewValidation,
    paginationValidation,
    uuidValidation,
    audienceValidation,
    dndValidation,
    importValidation,
    campaignValidation,
    settingsValidation,
    handleValidationErrors,
    sanitizeInputs,
    validatePhoneNumber
};
