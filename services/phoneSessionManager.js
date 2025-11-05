const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { WhatsAppAccount } = require('../models');
const webhookService = require('./webhookService');

class PhoneSessionManager {
    constructor() {
        this.sessions = new Map(); // phoneId -> { client, account, status }
        this.qrCodes = new Map(); // phoneId -> qrCode
        this.initialized = false;
    }

    /**
     * Initialize the session manager
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            console.log('🔄 Initializing PhoneSessionManager...');
            await this.initializeExistingSessions();
            this.initialized = true;
            console.log('✅ PhoneSessionManager initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize PhoneSessionManager:', error);
            throw error;
        }
    }

    /**
     * Initialize existing sessions from database on startup
     */
    async initializeExistingSessions() {
        try {
            const accounts = await WhatsAppAccount.findAll({
                where: { status: ['connected', 'pending'] }
            });

            for (const account of accounts) {
                console.log(`🔄 Initializing session for phone_id: ${account.phone_id}`);
                await this.createSession(account.phone_id, false); // Don't create new account
            }
        } catch (error) {
            console.error('❌ Error initializing existing sessions:', error);
        }
    }

    /**
     * Create a new WhatsApp session for a phone_id
     */
    async createSession(phoneId, createNewAccount = true) {
        try {
            // Check if session already exists
            if (this.sessions.has(phoneId)) {
                console.log(`⚠️ Session already exists for phone_id: ${phoneId}`);
                return this.sessions.get(phoneId);
            }

            let account;
            if (createNewAccount) {
                // Create new account record
                const token = WhatsAppAccount.generateToken();
                account = await WhatsAppAccount.create({
                    phone_id: phoneId,
                    token: token,
                    status: 'pending'
                });
                console.log(`✅ Created new account for phone_id: ${phoneId}`);
            } else {
                // Get existing account
                account = await WhatsAppAccount.findOne({ where: { phone_id: phoneId } });
                if (!account) {
                    throw new Error(`Account not found for phone_id: ${phoneId}`);
                }
            }

            // Create session directory
            const sessionPath = path.join('.wwebjs_auth', `session_${phoneId}`);
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            // Create WhatsApp client with unique session
            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: phoneId,
                    dataPath: '.wwebjs_auth'
                }),
                puppeteer: { 
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ]
                },
                webVersionCache: {
                    type: 'remote',
                    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
                }
            });

            // Set up event listeners
            this.setupClientEvents(client, account);

            // Store session
            const session = {
                client: client,
                account: account,
                status: 'initializing',
                phoneId: phoneId
            };

            this.sessions.set(phoneId, session);

            // Initialize client
            await client.initialize();

            return session;
        } catch (error) {
            console.error(`❌ Error creating session for ${phoneId}:`, error);
            throw error;
        }
    }

    /**
     * Set up event listeners for a WhatsApp client
     */
    setupClientEvents(client, account) {
        const phoneId = account.phone_id;

        client.on('qr', async (qr) => {
            try {
                console.log(`📱 QR Code generated for phone_id: ${phoneId}`);
                const qrImage = await qrcode.toDataURL(qr);
                
                // Store QR code
                this.qrCodes.set(phoneId, qrImage);
                
                // Update account with QR code
                await account.update({
                    qr_code: qrImage,
                    status: 'pending'
                });

                console.log(`✅ QR Code updated for phone_id: ${phoneId}`);
            } catch (error) {
                console.error(`❌ Error handling QR for ${phoneId}:`, error);
            }
        });

        client.on('ready', async () => {
            try {
                console.log(`✅ Client ready for phone_id: ${phoneId}`);
                
                // Get phone number
                const info = client.info;
                const phoneNumber = info.wid.user;
                
                // Clear QR code and update status
                this.qrCodes.delete(phoneId);
                await account.update({
                    phone_number: phoneNumber,
                    status: 'connected',
                    qr_code: null,
                    last_activity: new Date()
                });

                // Update session status
                const session = this.sessions.get(phoneId);
                if (session) {
                    session.status = 'connected';
                }

                // Set global ready flag for this account
                global[`whatsappReady_${phoneId}`] = true;

                console.log(`🎉 WhatsApp account ${phoneId} (${phoneNumber}) is ready!`);
            } catch (error) {
                console.error(`❌ Error in ready event for ${phoneId}:`, error);
            }
        });

        client.on('authenticated', async () => {
            try {
                console.log(`🔐 Authenticated for phone_id: ${phoneId}`);
                this.qrCodes.delete(phoneId);
                await account.update({
                    qr_code: null,
                    last_activity: new Date()
                });
            } catch (error) {
                console.error(`❌ Error in authenticated event for ${phoneId}:`, error);
            }
        });

        client.on('auth_failure', async (msg) => {
            try {
                console.error(`❌ Authentication failure for phone_id: ${phoneId}`, msg);
                await account.update({
                    status: 'failed',
                    last_activity: new Date()
                });

                // Update session status
                const session = this.sessions.get(phoneId);
                if (session) {
                    session.status = 'failed';
                }
            } catch (error) {
                console.error(`❌ Error in auth_failure event for ${phoneId}:`, error);
            }
        });

        client.on('disconnected', async (reason) => {
            try {
                console.log(`📴 Client disconnected for phone_id: ${phoneId}`, reason);
                await account.update({
                    status: 'disconnected',
                    last_activity: new Date()
                });

                // Update session status
                const session = this.sessions.get(phoneId);
                if (session) {
                    session.status = 'disconnected';
                }

                // Clear global ready flag
                global[`whatsappReady_${phoneId}`] = false;
            } catch (error) {
                console.error(`❌ Error in disconnected event for ${phoneId}:`, error);
            }
        });

        client.on('message', async (msg) => {
            try {
                // Update last activity
                await account.updateActivity();

                // Handle incoming message for this specific account
                await this.handleIncomingMessage(msg, account);
            } catch (error) {
                console.error(`❌ Error handling message for ${phoneId}:`, error);
            }
        });
    }

    /**
     * Handle incoming messages for a specific account
     */
    async handleIncomingMessage(msg, account) {
        try {
            console.log(`📨 Message received for ${account.phone_id}:`, msg.body);

            // Trigger webhook if configured
            if (account.webhook_url && account.webhook_events.includes('message')) {
                try {
                    const webhookData = {
                        phone_id: account.phone_id,
                        messageId: msg.id._serialized,
                        from: msg.from,
                        to: msg.to,
                        body: msg.body,
                        type: msg.type,
                        timestamp: new Date(msg.timestamp * 1000).toISOString(),
                        isGroupMsg: msg.isGroupMsg,
                        fromMe: msg.fromMe,
                        hasMedia: msg.hasMedia
                    };

                    await webhookService.sendWebhook(account.webhook_url, 'message', webhookData);
                } catch (webhookError) {
                    console.error(`❌ Webhook error for ${account.phone_id}:`, webhookError);
                }
            }

            // Save message to database if logging is enabled
            if (account.settings.message_logging) {
                await this.saveMessageToDatabase(msg, account);
            }
        } catch (error) {
            console.error(`❌ Error handling incoming message for ${account.phone_id}:`, error);
        }
    }

    /**
     * Save message to database with account context
     */
    async saveMessageToDatabase(msg, account) {
        try {
            const { Message, Contact, Chat } = require('../models');
            
            const chat = await msg.getChat();
            const contact = await msg.getContact();
            
            // Save or update contact with phone_id context
            await Contact.upsert({
                contactId: contact.id._serialized,
                name: contact.name || contact.pushname,
                pushname: contact.pushname,
                shortName: contact.shortName,
                number: contact.number,
                isUser: contact.isUser,
                isGroup: contact.isGroup,
                isWAContact: contact.isWAContact,
                phone_id: account.phone_id // Add phone_id association
            });
            
            // Save or update chat with phone_id context
            await Chat.upsert({
                chatId: chat.id._serialized,
                name: chat.name,
                isGroup: chat.isGroup,
                isReadOnly: chat.isReadOnly,
                unreadCount: chat.unreadCount,
                timestamp: new Date(msg.timestamp * 1000),
                archived: chat.archived,
                pinned: chat.pinned,
                isMuted: chat.isMuted,
                phone_id: account.phone_id // Add phone_id association
            });
            
            // Save or update message with phone_id context
            await Message.upsert({
                messageId: msg.id._serialized,
                from: msg.from,
                to: msg.to,
                body: msg.body,
                type: msg.type,
                timestamp: new Date(msg.timestamp * 1000),
                isGroupMsg: msg.isGroupMsg,
                author: msg.author,
                quotedMsgId: msg.quotedMsgId,
                isForwarded: msg.isForwarded,
                forwardingScore: msg.forwardingScore,
                isStatus: msg.isStatus,
                isStarred: msg.isStarred,
                fromMe: msg.fromMe,
                phone_id: account.phone_id, // Add phone_id association
                mediaData: msg.hasMedia ? {
                    hasMedia: true,
                    mimetype: msg.mimetype,
                    filename: msg.filename
                } : null,
                location: msg.location || null,
                vCards: msg.vCards || null
            });
            
            console.log(`✅ Message saved to database for ${account.phone_id}`);
        } catch (error) {
            console.error(`❌ Error saving message to database for ${account.phone_id}:`, error);
        }
    }

    /**
     * Get a session by phone_id
     */
    getSession(phoneId) {
        return this.sessions.get(phoneId);
    }

    /**
     * Get client by phone_id
     */
    getClient(phoneId) {
        const session = this.sessions.get(phoneId);
        return session ? session.client : null;
    }

    /**
     * Get QR code for a phone_id
     */
    getQRCode(phoneId) {
        return this.qrCodes.get(phoneId);
    }

    /**
     * Remove a session
     */
    async removeSession(phoneId) {
        try {
            const session = this.sessions.get(phoneId);
            if (session) {
                // Destroy client with error handling
                if (session.client) {
                    try {
                        // Check if browser page is still open
                        if (session.client.pupPage && !session.client.pupPage.isClosed()) {
                            await session.client.logout();
                        }
                    } catch (logoutError) {
                        console.log(`Logout skipped for ${phoneId} (page already closed):`, logoutError.message);
                    }
                    
                    try {
                        await session.client.destroy();
                    } catch (destroyError) {
                        console.log(`Destroy skipped for ${phoneId} (already destroyed):`, destroyError.message);
                    }
                }

                // Remove from maps
                this.sessions.delete(phoneId);
                this.qrCodes.delete(phoneId);

                // Update account status
                await session.account.update({
                    status: 'disconnected',
                    qr_code: null
                });

                console.log(`🗑️ Session removed for phone_id: ${phoneId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Error removing session for ${phoneId}:`, error);
            // Still cleanup maps even on error
            this.sessions.delete(phoneId);
            this.qrCodes.delete(phoneId);
            throw error;
        }
    }

    /**
     * Get all active sessions
     */
    getAllSessions() {
        const sessions = [];
        for (const [phoneId, session] of this.sessions) {
            sessions.push({
                phone_id: phoneId,
                status: session.status,
                account: {
                    id: session.account.id,
                    phone_number: session.account.phone_number,
                    name: session.account.name,
                    last_activity: session.account.last_activity
                }
            });
        }
        return sessions;
    }

    /**
     * Check if a session is ready
     */
    isSessionReady(phoneId) {
        const session = this.sessions.get(phoneId);
        return session && session.status === 'connected';
    }

    /**
     * Restart a session
     */
    async restartSession(phoneId) {
        try {
            await this.removeSession(phoneId);
            await this.createSession(phoneId, false);
            console.log(`🔄 Session restarted for phone_id: ${phoneId}`);
        } catch (error) {
            console.error(`❌ Error restarting session for ${phoneId}:`, error);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new PhoneSessionManager();