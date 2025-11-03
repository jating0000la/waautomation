const { ApiKey } = require('../models');

/**
 * Authentication middleware for legacy routes
 * Validates API key from X-API-Key header or Authorization Bearer token
 */
async function legacyAuthMiddleware(req, res, next) {
    try {
        // Check for API key in headers
        const apiKey = req.headers['x-api-key'] || 
                      (req.headers['authorization']?.startsWith('Bearer ') 
                       ? req.headers['authorization'].replace('Bearer ', '') 
                       : null);
        
        if (!apiKey) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'API key required. Add X-API-Key header or use Bearer token in Authorization header.',
                example: 'X-API-Key: your-api-key-here'
            });
        }

        // Validate API key in database
        const key = await ApiKey.findOne({ 
            where: { 
                key: apiKey, 
                isActive: true 
            } 
        });

        if (!key) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid or inactive API key. Please check your API key or create a new one at /api/keys'
            });
        }

        // Update last used timestamp
        await key.update({ 
            lastUsedAt: new Date(),
            usageCount: (key.usageCount || 0) + 1
        });

        // Attach API key info to request for logging
        req.apiKey = {
            id: key.id,
            name: key.name,
            keyPreview: apiKey.substring(0, 8) + '...'
        };

        next();
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        res.status(500).json({ 
            error: 'Authentication error', 
            message: 'An error occurred during authentication',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Optional authentication - allows both authenticated and unauthenticated requests
 * Useful for endpoints that have different behavior for authenticated users
 */
async function optionalAuthMiddleware(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'] || 
                      (req.headers['authorization']?.startsWith('Bearer ') 
                       ? req.headers['authorization'].replace('Bearer ', '') 
                       : null);
        
        if (apiKey) {
            const key = await ApiKey.findOne({ 
                where: { 
                    key: apiKey, 
                    isActive: true 
                } 
            });

            if (key) {
                await key.update({ 
                    lastUsedAt: new Date(),
                    usageCount: (key.usageCount || 0) + 1
                });

                req.apiKey = {
                    id: key.id,
                    name: key.name,
                    keyPreview: apiKey.substring(0, 8) + '...'
                };
            }
        }

        next();
    } catch (error) {
        console.error('❌ Optional auth middleware error:', error);
        next(); // Continue even if authentication fails
    }
}

module.exports = { 
    legacyAuthMiddleware,
    optionalAuthMiddleware
};
