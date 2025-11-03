const { WhatsAppAccount } = require('../models');
const { logger } = require('../utils/logger');

/**
 * Middleware to authenticate API requests using phone_id and token
 */
const authenticatePhoneAPI = async (req, res, next) => {
    try {
        // HTTP headers normalize underscores to hyphens, so check both formats
        const phone_id = req.headers['phone-id'] || req.headers['phone_id'];
        const token = req.headers['token'];

        // Check if phone_id and token are provided
        if (!phone_id || !token) {
            logger.warn('Authentication failed: Missing credentials', {
                ip: req.ip,
                path: req.path,
                phone_id_provided: !!phone_id,
                token_provided: !!token
            });
            
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please provide phone-id and token in headers',
                required_headers: ['phone-id', 'token']
            });
        }

        // Find account by phone_id and token
        const account = await WhatsAppAccount.findOne({
            where: {
                phone_id: phone_id,
                token: token
            }
        });

        if (!account) {
            logger.warn('Authentication failed: Invalid credentials', {
                ip: req.ip,
                path: req.path,
                phone_id: phone_id
            });
            
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Invalid phone_id or token'
            });
        }

        // Check if account is active
        if (account.status === 'failed') {
            logger.warn('Authentication failed: Account in failed state', {
                ip: req.ip,
                phone_id: phone_id
            });
            
            return res.status(403).json({
                error: 'Account failed',
                message: 'This WhatsApp account has failed authentication. Please re-authenticate.'
            });
        }

        // Update last activity
        await account.updateActivity();

        // Add account to request object
        req.whatsappAccount = account;
        req.phoneId = phone_id;

        logger.debug('Authentication successful', {
            phone_id: phone_id,
            path: req.path
        });

        next();
    } catch (error) {
        logger.error('Authentication error:', {
            error: error.message,
            stack: error.stack,
            ip: req.ip,
            path: req.path
        });
        
        res.status(500).json({
            error: 'Authentication error',
            message: 'Internal server error during authentication'
        });
    }
};

/**
 * Middleware to check if the WhatsApp session is ready
 */
const requireSessionReady = (phoneSessionManager) => {
    return (req, res, next) => {
        const phoneId = req.phoneId;
        
        if (!phoneSessionManager.isSessionReady(phoneId)) {
            return res.status(503).json({
                error: 'Session not ready',
                message: 'WhatsApp session is not ready. Please check account status.',
                phone_id: phoneId
            });
        }

        // Add client to request object
        req.whatsappClient = phoneSessionManager.getClient(phoneId);
        next();
    };
};

/**
 * Optional authentication for endpoints that can work without auth
 */
const optionalPhoneAuth = async (req, res, next) => {
    try {
        // HTTP headers normalize underscores to hyphens, so check both formats
        const phone_id = req.headers['phone-id'] || req.headers['phone_id'];
        const token = req.headers['token'];

        if (phone_id && token) {
            const account = await WhatsAppAccount.findOne({
                where: {
                    phone_id: phone_id,
                    token: token
                }
            });

            if (account && account.status !== 'failed') {
                await account.updateActivity();
                req.whatsappAccount = account;
                req.phoneId = phone_id;
            }
        }

        next();
    } catch (error) {
        console.error('❌ Optional auth error:', error);
        next(); // Continue without authentication
    }
};

/**
 * Middleware to validate phone_id format
 */
const validatePhoneId = (req, res, next) => {
    // HTTP headers normalize underscores to hyphens, so check both formats
    const phone_id = req.headers['phone-id'] || req.headers['phone_id'];
    
    if (phone_id && !/^[a-zA-Z0-9_-]+$/.test(phone_id)) {
        return res.status(400).json({
            error: 'Invalid phone_id format',
            message: 'phone_id can only contain letters, numbers, hyphens, and underscores'
        });
    }
    
    next();
};

/**
 * Middleware to check account permissions for specific operations
 */
const checkAccountPermissions = (requiredPermissions = []) => {
    return (req, res, next) => {
        const account = req.whatsappAccount;
        
        if (!account) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please authenticate first'
            });
        }

        // Check if account has required permissions (if implemented)
        // For now, all authenticated accounts have full access
        
        next();
    };
};

module.exports = {
    authenticatePhoneAPI,
    requireSessionReady,
    optionalPhoneAuth,
    validatePhoneId,
    checkAccountPermissions
};