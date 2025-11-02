const crypto = require('crypto');

/**
 * API Key Authentication Middleware
 * Validates API keys from external tools/applications
 */

// In-memory rate limiting (for production, use Redis)
const rateLimitStore = new Map();

async function apiKeyAuth(req, res, next) {
    try {
        // Get API key from header
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key required',
                message: 'Please provide an API key in the X-API-Key header or Authorization Bearer token'
            });
        }

        // Get ApiKey model
        const { ApiKey } = require('../models');
        
        // Hash the provided key
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        // Find the API key in database
        const apiKeyRecord = await ApiKey.findOne({
            where: {
                keyHash: keyHash,
                isActive: true
            }
        });

        if (!apiKeyRecord) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key',
                message: 'The provided API key is invalid or has been deactivated'
            });
        }

        // Check if key is expired
        if (apiKeyRecord.isExpired()) {
            return res.status(401).json({
                success: false,
                error: 'API key expired',
                message: 'The provided API key has expired'
            });
        }

        // Check IP whitelist
        const clientIp = req.ip || req.connection.remoteAddress;
        if (!apiKeyRecord.isIpAllowed(clientIp)) {
            return res.status(403).json({
                success: false,
                error: 'IP not allowed',
                message: 'Your IP address is not authorized to use this API key'
            });
        }

        // Rate limiting
        const rateLimitKey = `${apiKeyRecord.id}:${Math.floor(Date.now() / 60000)}`;
        const currentCount = rateLimitStore.get(rateLimitKey) || 0;
        
        if (currentCount >= apiKeyRecord.rateLimit) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: `Rate limit of ${apiKeyRecord.rateLimit} requests per minute exceeded`,
                retryAfter: 60
            });
        }
        
        rateLimitStore.set(rateLimitKey, currentCount + 1);
        
        // Clean up old rate limit entries (older than 2 minutes)
        const twoMinutesAgo = Math.floor(Date.now() / 60000) - 2;
        for (const key of rateLimitStore.keys()) {
            const timestamp = parseInt(key.split(':')[1]);
            if (timestamp < twoMinutesAgo) {
                rateLimitStore.delete(key);
            }
        }

        // Record usage (async, don't wait)
        apiKeyRecord.recordUsage().catch(err => {
            console.error('Failed to record API key usage:', err);
        });

        // Attach API key info to request
        req.apiKey = apiKeyRecord;
        req.apiKeyId = apiKeyRecord.id;
        
        next();
    } catch (error) {
        console.error('API auth error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication error',
            message: 'An error occurred while validating your API key'
        });
    }
}

/**
 * Permission checking middleware
 * Usage: requirePermission('sendMessage')
 */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.apiKey) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'API key authentication required'
            });
        }

        if (!req.apiKey.hasPermission(permission)) {
            return res.status(403).json({
                success: false,
                error: 'Permission denied',
                message: `Your API key does not have permission to: ${permission}`
            });
        }

        next();
    };
}

/**
 * Optional API key authentication
 * Doesn't fail if no key provided, but validates if present
 */
async function optionalApiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
        return next();
    }

    // If key is provided, validate it
    return apiKeyAuth(req, res, next);
}

module.exports = {
    apiKeyAuth,
    requirePermission,
    optionalApiKeyAuth
};
