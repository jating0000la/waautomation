const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers middleware
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiting for template creation/updates
const templateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 template operations per windowMs
    message: 'Too many template operations, please try again later.',
});

// Rate limiting for preview endpoint (can be abused)
const previewLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 previews per minute
    message: 'Too many preview requests, please slow down.',
});

// Stricter rate limiting for import operations
const importLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Max 10 imports per hour
    message: 'Too many import attempts. Please try again later.',
});

// Rate limiting for DND operations
const dndLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Max 50 DND operations per 15 minutes
    message: 'Too many DND operations. Please try again later.',
});

// Rate limiting for campaign operations
const campaignLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Max 20 campaign operations per 15 minutes
    message: 'Too many campaign operations. Please try again later.',
});

// Rate limiting for settings operations (very strict)
const settingsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Max 10 settings updates per hour
    message: 'Too many settings operations. Please try again later.',
});

// Rate limiting for status endpoint
const statusLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Max 60 status checks per minute
    message: 'Too many status requests. Please slow down.',
});

// CSRF token middleware (simple implementation)
function csrfProtection(req, res, next) {
    // Skip CSRF for safe methods
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    
    // Skip CSRF for API routes (they use API key auth)
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    // For now, skip CSRF for all JSON requests
    // In production, implement proper CSRF token validation
    const contentType = req.headers['content-type'];
    if (contentType && contentType.includes('application/json')) {
        return next();
    }
    
    next();
}

module.exports = {
    securityHeaders,
    apiLimiter,
    templateLimiter,
    previewLimiter,
    importLimiter,
    dndLimiter,
    campaignLimiter,
    settingsLimiter,
    statusLimiter,
    csrfProtection
};
