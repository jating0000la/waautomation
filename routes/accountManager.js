const express = require('express');
const router = express.Router();
const { WhatsAppAccount } = require('../models');
const phoneSessionManager = require('../services/phoneSessionManager');

// Note: validatePhoneId middleware removed from global application
// It should only be used where phone-id header is actually required

/**
 * Create a new WhatsApp account
 * POST /api/accounts/create
 */
router.post('/create', async (req, res) => {
    try {
        const { phone_id, name, webhook_url, webhook_events } = req.body;

        // Validate required fields
        if (!phone_id) {
            return res.status(400).json({
                error: 'Missing required field',
                message: 'phone_id is required'
            });
        }

        // Validate phone_id format
        if (!/^[a-zA-Z0-9_-]+$/.test(phone_id)) {
            return res.status(400).json({
                error: 'Invalid phone_id format',
                message: 'phone_id can only contain letters, numbers, hyphens, and underscores'
            });
        }

        // Check if account already exists
        const existingAccount = await WhatsAppAccount.findOne({
            where: { phone_id: phone_id }
        });

        if (existingAccount) {
            return res.status(409).json({
                error: 'Account already exists',
                message: `Account with phone_id '${phone_id}' already exists`,
                phone_id: phone_id,
                status: existingAccount.status,
                token: existingAccount.token
            });
        }

        // Create new session and account
        const session = await phoneSessionManager.createSession(phone_id, true);
        const account = session.account;

        // Update optional fields
        if (name || webhook_url || webhook_events) {
            const updateData = {};
            if (name) updateData.name = name;
            if (webhook_url) updateData.webhook_url = webhook_url;
            if (webhook_events) updateData.webhook_events = webhook_events;
            
            await account.update(updateData);
        }

        res.status(201).json({
            success: true,
            message: 'WhatsApp account created successfully',
            account: {
                id: account.id,
                phone_id: account.phone_id,
                token: account.token,
                name: account.name,
                status: account.status,
                webhook_url: account.webhook_url,
                webhook_events: account.webhook_events,
                created_at: account.created_at
            },
            next_steps: [
                'Use the QR code endpoint to get QR code for authentication',
                'Scan the QR code with WhatsApp',
                'Use phone_id and token for API authentication'
            ]
        });
    } catch (error) {
        console.error('❌ Error creating account:', error);
        res.status(500).json({
            error: 'Failed to create account',
            message: error.message
        });
    }
});

/**
 * Get QR code for account authentication
 * GET /api/accounts/:phone_id/qr
 */
router.get('/:phone_id/qr', async (req, res) => {
    try {
        const { phone_id } = req.params;

        // Find account
        const account = await WhatsAppAccount.findOne({
            where: { phone_id: phone_id }
        });

        if (!account) {
            return res.status(404).json({
                error: 'Account not found',
                message: `No account found with phone_id: ${phone_id}`
            });
        }

        // Check if already authenticated
        if (account.status === 'connected') {
            return res.status(200).json({
                success: true,
                authenticated: true,
                phone_id: phone_id,
                phone_number: account.phone_number,
                message: 'Account is already authenticated'
            });
        }

        // Get QR code from session manager
        let qrCode = phoneSessionManager.getQRCode(phone_id) || account.qr_code;

        // If no QR code and no active session, reinitialize the session
        if (!qrCode) {
            const session = phoneSessionManager.getSession(phone_id);
            
            if (!session) {
                // Session doesn't exist (likely after logout), reinitialize it
                console.log(`🔄 No session found for ${phone_id}, reinitializing...`);
                
                try {
                    await phoneSessionManager.createSession(phone_id, false);
                    
                    // Wait longer for QR to be generated (increased from 2 to 5 seconds)
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Try to get QR code again
                    qrCode = phoneSessionManager.getQRCode(phone_id);
                    
                    if (!qrCode) {
                        return res.status(202).json({
                            success: true,
                            message: 'Session is being initialized. QR code will be available shortly. Please try again in a few seconds.',
                            phone_id: phone_id,
                            status: 'initializing',
                            retry_after: 5
                        });
                    }
                } catch (initError) {
                    console.error(`❌ Error reinitializing session for ${phone_id}:`, initError);
                    return res.status(500).json({
                        error: 'Failed to initialize session',
                        message: initError.message,
                        phone_id: phone_id
                    });
                }
            } else {
                // Session exists but no QR yet, wait a bit
                await new Promise(resolve => setTimeout(resolve, 3000));
                qrCode = phoneSessionManager.getQRCode(phone_id);
                
                if (!qrCode) {
                    return res.status(202).json({
                        success: true,
                        message: 'QR code is being generated. Please wait a moment and try again.',
                        phone_id: phone_id,
                        status: account.status,
                        retry_after: 3
                    });
                }
            }
        }

        res.json({
            success: true,
            phone_id: phone_id,
            qr_code: qrCode,
            status: account.status,
            message: 'Scan this QR code with WhatsApp to authenticate'
        });
    } catch (error) {
        console.error('❌ Error getting QR code:', error);
        res.status(500).json({
            error: 'Failed to get QR code',
            message: error.message
        });
    }
});

/**
 * Reinitialize/Refresh account session (regenerate QR code)
 * POST /api/accounts/:phone_id/refresh
 */
router.post('/:phone_id/refresh', async (req, res) => {
    try {
        const { phone_id } = req.params;

        // Find account
        const account = await WhatsAppAccount.findOne({
            where: { phone_id: phone_id }
        });

        if (!account) {
            return res.status(404).json({
                error: 'Account not found',
                message: `No account found with phone_id: ${phone_id}`
            });
        }

        // If account is already connected, inform user
        if (account.status === 'connected') {
            return res.status(200).json({
                success: true,
                message: 'Account is already connected',
                phone_id: phone_id,
                phone_number: account.phone_number
            });
        }

        // Remove existing session if any
        const existingSession = phoneSessionManager.getSession(phone_id);
        if (existingSession) {
            console.log(`🔄 Removing existing session for ${phone_id}...`);
            await phoneSessionManager.removeSession(phone_id);
        }

        // Create new session (this will generate new QR code)
        console.log(`🔄 Reinitializing session for ${phone_id}...`);
        await phoneSessionManager.createSession(phone_id, false);

        res.json({
            success: true,
            message: 'Session reinitialized successfully. QR code will be generated shortly.',
            phone_id: phone_id,
            next_step: 'Check /api/accounts/{phone_id}/qr endpoint for QR code'
        });
    } catch (error) {
        console.error('❌ Error refreshing session:', error);
        res.status(500).json({
            error: 'Failed to refresh session',
            message: error.message
        });
    }
});

/**
 * Get account status
 * GET /api/accounts/:phone_id/status
 */
router.get('/:phone_id/status', async (req, res) => {
    try {
        const { phone_id } = req.params;

        // Find account
        const account = await WhatsAppAccount.findOne({
            where: { phone_id: phone_id }
        });

        if (!account) {
            return res.status(404).json({
                error: 'Account not found',
                message: `No account found with phone_id: ${phone_id}`
            });
        }

        // Get session info
        const session = phoneSessionManager.getSession(phone_id);
        const isSessionReady = phoneSessionManager.isSessionReady(phone_id);

        res.json({
            success: true,
            account: {
                id: account.id,
                phone_id: account.phone_id,
                phone_number: account.phone_number,
                name: account.name,
                status: account.status,
                last_activity: account.last_activity,
                created_at: account.created_at
            },
            session: {
                exists: !!session,
                ready: isSessionReady,
                has_qr: !!phoneSessionManager.getQRCode(phone_id)
            }
        });
    } catch (error) {
        console.error('❌ Error getting account status:', error);
        res.status(500).json({
            error: 'Failed to get account status',
            message: error.message
        });
    }
});

/**
 * Update account settings
 * PUT /api/accounts/:phone_id/settings
 */
router.put('/:phone_id/settings', async (req, res) => {
    try {
        const { phone_id } = req.params;
        const { name, webhook_url, webhook_events, settings } = req.body;

        // Find account
        const account = await WhatsAppAccount.findOne({
            where: { phone_id: phone_id }
        });

        if (!account) {
            return res.status(404).json({
                error: 'Account not found',
                message: `No account found with phone_id: ${phone_id}`
            });
        }

        // Prepare update data
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
        if (webhook_events !== undefined) updateData.webhook_events = webhook_events;
        if (settings !== undefined) updateData.settings = { ...account.settings, ...settings };

        // Update account
        await account.update(updateData);

        res.json({
            success: true,
            message: 'Account settings updated successfully',
            account: {
                id: account.id,
                phone_id: account.phone_id,
                phone_number: account.phone_number,
                name: account.name,
                webhook_url: account.webhook_url,
                webhook_events: account.webhook_events,
                settings: account.settings,
                updated_at: new Date()
            }
        });
    } catch (error) {
        console.error('❌ Error updating account settings:', error);
        res.status(500).json({
            error: 'Failed to update account settings',
            message: error.message
        });
    }
});

/**
 * Restart WhatsApp session
 * POST /api/accounts/:phone_id/restart
 */
router.post('/:phone_id/restart', async (req, res) => {
    try {
        const { phone_id } = req.params;

        // Find account
        const account = await WhatsAppAccount.findOne({
            where: { phone_id: phone_id }
        });

        if (!account) {
            return res.status(404).json({
                error: 'Account not found',
                message: `No account found with phone_id: ${phone_id}`
            });
        }

        // Restart session
        await phoneSessionManager.restartSession(phone_id);

        res.json({
            success: true,
            message: 'WhatsApp session restarted successfully',
            phone_id: phone_id
        });
    } catch (error) {
        console.error('❌ Error restarting session:', error);
        res.status(500).json({
            error: 'Failed to restart session',
            message: error.message
        });
    }
});

/**
 * Logout and remove account
 * DELETE /api/accounts/:phone_id
 */
router.delete('/:phone_id', async (req, res) => {
    try {
        const { phone_id } = req.params;

        // Find account
        const account = await WhatsAppAccount.findOne({
            where: { phone_id: phone_id }
        });

        if (!account) {
            return res.status(404).json({
                error: 'Account not found',
                message: `No account found with phone_id: ${phone_id}`
            });
        }

        // Remove session
        await phoneSessionManager.removeSession(phone_id);

        // Delete account from database
        await account.destroy();

        res.json({
            success: true,
            message: 'WhatsApp account removed successfully',
            phone_id: phone_id
        });
    } catch (error) {
        console.error('❌ Error removing account:', error);
        res.status(500).json({
            error: 'Failed to remove account',
            message: error.message
        });
    }
});

/**
 * List all accounts
 * GET /api/accounts
 */
router.get('/', async (req, res) => {
    try {
        const accounts = await WhatsAppAccount.findAll({
            attributes: [
                'id', 'phone_id', 'phone_number', 'name', 'status', 
                'last_activity', 'created_at', 'updated_at', 'token'
            ],
            order: [['created_at', 'DESC']]
        });

        // Add session information
        const accountsWithSession = accounts.map(account => {
            const session = phoneSessionManager.getSession(account.phone_id);
            const isReady = phoneSessionManager.isSessionReady(account.phone_id);
            
            return {
                ...account.toJSON(),
                session: {
                    exists: !!session,
                    ready: isReady,
                    has_qr: !!phoneSessionManager.getQRCode(account.phone_id)
                }
            };
        });

        res.json({
            success: true,
            accounts: accountsWithSession,
            total: accounts.length
        });
    } catch (error) {
        console.error('❌ Error listing accounts:', error);
        res.status(500).json({
            error: 'Failed to list accounts',
            message: error.message
        });
    }
});

/**
 * Logout specific account (disconnect but keep in database)
 * POST /api/accounts/:phone_id/logout
 */
router.post('/:phone_id/logout', async (req, res) => {
    try {
        const { phone_id } = req.params;

        // Find account
        const account = await WhatsAppAccount.findOne({
            where: { phone_id: phone_id }
        });

        if (!account) {
            return res.status(404).json({
                error: 'Account not found',
                message: `No account found with phone_id: ${phone_id}`
            });
        }

        // Get session and logout
        const session = phoneSessionManager.getSession(phone_id);
        if (session && session.client) {
            await session.client.logout();
            await session.client.destroy();
        }

        // Remove session but keep account
        phoneSessionManager.sessions.delete(phone_id);
        phoneSessionManager.qrCodes.delete(phone_id);

        // Update account status
        await account.update({
            status: 'disconnected',
            qr_code: null,
            phone_number: null
        });

        res.json({
            success: true,
            message: 'WhatsApp account logged out successfully',
            phone_id: phone_id
        });
    } catch (error) {
        console.error('❌ Error logging out account:', error);
        res.status(500).json({
            error: 'Failed to logout account',
            message: error.message
        });
    }
});

module.exports = router;