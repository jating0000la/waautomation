const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

/**
 * API Key Management Routes
 * For administrators to create and manage API keys
 */

/**
 * @route GET /api/keys
 * @desc Get all API keys (admin only)
 * @access Protected
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const { ApiKey } = require('../models');
        
        const keys = await ApiKey.findAll({
            order: [['createdAt', 'DESC']],
            attributes: { 
                exclude: ['key', 'keyHash'] // Don't expose actual keys
            }
        });

        res.json({
            success: true,
            keys: keys,
            total: keys.length
        });
    } catch (error) {
        console.error('Error fetching API keys:', error);
        
        // Check if it's a table doesn't exist error
        if (error.original && error.original.code === '42P01') {
            return res.status(503).json({
                success: false,
                error: 'Database not initialized',
                message: 'Please connect WhatsApp first by scanning the QR code at /account.html. The database tables will be created automatically.'
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/keys
 * @desc Create a new API key
 * @access Protected
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { ApiKey } = require('../models');
        const { 
            name, 
            description, 
            permissions, 
            rateLimit, 
            ipWhitelist,
            expiresAt 
        } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Name is required'
            });
        }

        // Generate new API key
        const key = ApiKey.generateKey('wa');
        const keyHash = ApiKey.hashKey(key);

        // Create API key record
        const apiKey = await ApiKey.create({
            name,
            description: description || '',
            key: key, // Store temporarily for initial display
            keyHash: keyHash,
            permissions: permissions || {
                sendMessage: true,
                sendMedia: true,
                sendLocation: true,
                sendContact: true,
                sendReaction: true,
                createGroup: true,
                manageGroups: true,
                readMessages: true,
                webhook: true
            },
            rateLimit: rateLimit || 100,
            ipWhitelist: ipWhitelist || [],
            expiresAt: expiresAt || null,
            isActive: true,
            createdBy: req.user?.username || 'admin'
        });

        console.log(`✅ New API key created: ${name}`);

        res.json({
            success: true,
            message: 'API key created successfully. Save this key securely - it will not be shown again!',
            apiKey: {
                id: apiKey.id,
                name: apiKey.name,
                key: key, // Only shown once!
                permissions: apiKey.permissions,
                rateLimit: apiKey.rateLimit,
                expiresAt: apiKey.expiresAt,
                createdAt: apiKey.createdAt
            }
        });

        // Remove the plain key from database after creation
        setTimeout(async () => {
            await apiKey.update({ key: '[HIDDEN]' });
        }, 1000);

    } catch (error) {
        console.error('Error creating API key:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/keys/:id
 * @desc Get API key details
 * @access Protected
 */
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { ApiKey } = require('../models');
        
        const apiKey = await ApiKey.findByPk(req.params.id, {
            attributes: { exclude: ['key', 'keyHash'] }
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        res.json({
            success: true,
            apiKey: apiKey
        });
    } catch (error) {
        console.error('Error fetching API key:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route PUT /api/keys/:id
 * @desc Update API key
 * @access Protected
 */
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { ApiKey } = require('../models');
        const { 
            name, 
            description, 
            permissions, 
            rateLimit, 
            ipWhitelist,
            isActive,
            expiresAt
        } = req.body;

        const apiKey = await ApiKey.findByPk(req.params.id);

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        // Update fields
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (permissions !== undefined) updates.permissions = permissions;
        if (rateLimit !== undefined) updates.rateLimit = rateLimit;
        if (ipWhitelist !== undefined) updates.ipWhitelist = ipWhitelist;
        if (isActive !== undefined) updates.isActive = isActive;
        if (expiresAt !== undefined) updates.expiresAt = expiresAt;

        await apiKey.update(updates);

        console.log(`✅ API key updated: ${apiKey.name}`);

        res.json({
            success: true,
            message: 'API key updated successfully',
            apiKey: {
                id: apiKey.id,
                name: apiKey.name,
                permissions: apiKey.permissions,
                rateLimit: apiKey.rateLimit,
                isActive: apiKey.isActive,
                expiresAt: apiKey.expiresAt,
                updatedAt: apiKey.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating API key:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route DELETE /api/keys/:id
 * @desc Delete API key
 * @access Protected
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { ApiKey } = require('../models');
        
        const apiKey = await ApiKey.findByPk(req.params.id);

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        const keyName = apiKey.name;
        await apiKey.destroy();

        console.log(`✅ API key deleted: ${keyName}`);

        res.json({
            success: true,
            message: 'API key deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting API key:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/keys/:id/regenerate
 * @desc Regenerate API key (creates new key, invalidates old one)
 * @access Protected
 */
router.post('/:id/regenerate', requireAuth, async (req, res) => {
    try {
        const { ApiKey } = require('../models');
        
        const apiKey = await ApiKey.findByPk(req.params.id);

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        // Generate new key
        const newKey = ApiKey.generateKey('wa');
        const newKeyHash = ApiKey.hashKey(newKey);

        await apiKey.update({
            key: newKey,
            keyHash: newKeyHash,
            usageCount: 0,
            lastUsed: null
        });

        console.log(`✅ API key regenerated: ${apiKey.name}`);

        res.json({
            success: true,
            message: 'API key regenerated successfully. Save this key securely - it will not be shown again!',
            apiKey: {
                id: apiKey.id,
                name: apiKey.name,
                key: newKey, // Only shown once!
                regeneratedAt: new Date().toISOString()
            }
        });

        // Hide key after creation
        setTimeout(async () => {
            await apiKey.update({ key: '[HIDDEN]' });
        }, 1000);

    } catch (error) {
        console.error('Error regenerating API key:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/keys/:id/stats
 * @desc Get API key usage statistics
 * @access Protected
 */
router.get('/:id/stats', requireAuth, async (req, res) => {
    try {
        const { ApiKey } = require('../models');
        
        const apiKey = await ApiKey.findByPk(req.params.id, {
            attributes: { exclude: ['key', 'keyHash'] }
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        const stats = {
            name: apiKey.name,
            usageCount: apiKey.usageCount,
            lastUsed: apiKey.lastUsed,
            isActive: apiKey.isActive,
            isExpired: apiKey.isExpired(),
            rateLimit: apiKey.rateLimit,
            createdAt: apiKey.createdAt
        };

        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Error fetching API key stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
