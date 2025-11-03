const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Database imports
const { sequelize, testConnection } = require('./database');
const { Message, Contact, Group, Chat, WebhookLog, ApiKey, WhatsAppAccount } = require('./models');

// External API imports
const externalApiRoutes = require('./routes/externalApi');
const apiKeysRoutes = require('./routes/apiKeys');
const accountManagerRoutes = require('./routes/accountManager');
const multiAccountApiRoutes = require('./routes/multiAccountApi');
const webhookService = require('./services/webhookService');

// Multi-account support
const phoneSessionManager = require('./services/phoneSessionManager');

// Security middleware imports
const { securityHeaders, apiLimiter, csrfProtection } = require('./middleware/security');
const { legacyAuthMiddleware, optionalAuthMiddleware } = require('./middleware/legacyAuth');

const app = express();

// Apply security headers first
app.use(securityHeaders);

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// CSRF protection (for forms, not API)
app.use(csrfProtection);

app.use(express.static('public'));
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' })); // Add size limit
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Add API routes
app.use('/api/external', externalApiRoutes);
app.use('/api/keys', apiKeysRoutes);
app.use('/api/accounts', accountManagerRoutes);
app.use('/api/v2', multiAccountApiRoutes); // New multi-account API

// WhatsApp client
let client = new Client({
    authStrategy: new LocalAuth({
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

let qrCodeData = null;
let clientReady = false; // internal flag
global.whatsappReady = false; // exported readiness flag for schedulers

client.on('qr', (qr) => {
    qrCodeData = qr;
    console.log('✅ QR Code Generated - Please scan with WhatsApp');
    console.log('📱 View QR at: http://localhost:3000/account.html');
});

client.on('ready', async () => {
    qrCodeData = null; // Clear QR code once authenticated
    clientReady = true;
    global.whatsappReady = true;
    console.log('✅ Client is ready and authenticated!');
    
    // Sync database tables
    try {
        await sequelize.sync({ force: false });
        console.log('✅ Database tables synchronized');
        
        // Initialize webhook service
        await webhookService.initialize();
        console.log('✅ Webhook service initialized');
    } catch (error) {
        console.error('❌ Database sync error:', error);
    }
});

client.on('authenticated', () => {
    qrCodeData = null; // Clear QR code after authentication
    console.log('✅ AUTHENTICATED - Session saved');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('disconnected', (reason) => {
    clientReady = false;
    global.whatsappReady = false;
    console.log('Client was logged out', reason);
});

client.on('message', async msg => {
    console.log('Received message:', msg.body);
    
    // Trigger webhook for incoming message
    try {
        await webhookService.trigger('message', {
            messageId: msg.id._serialized,
            from: msg.from,
            to: msg.to,
            body: msg.body,
            type: msg.type,
            timestamp: new Date(msg.timestamp * 1000).toISOString(),
            isGroupMsg: msg.isGroupMsg,
            fromMe: msg.fromMe,
            hasMedia: msg.hasMedia
        });
    } catch (error) {
        console.error('❌ Error triggering webhook:', error);
    }
    
    // Save message to database
    try {
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        
        // Save or update contact
        await Contact.upsert({
            contactId: contact.id._serialized,
            name: contact.name || contact.pushname,
            pushname: contact.pushname,
            shortName: contact.shortName,
            number: contact.number,
            isUser: contact.isUser,
            isGroup: contact.isGroup,
            isWAContact: contact.isWAContact
        }); 
        
        // Save or update chat
        await Chat.upsert({
            chatId: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            isReadOnly: chat.isReadOnly,
            unreadCount: chat.unreadCount,
            timestamp: new Date(msg.timestamp * 1000),
            archived: chat.archived,
            pinned: chat.pinned,
            isMuted: chat.isMuted
        });
        
        // Save message
        await Message.create({
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
            mediaData: msg.hasMedia ? {
                hasMedia: true,
                mimetype: msg.mimetype,
                filename: msg.filename
            } : null,
            location: msg.location || null,
            vCards: msg.vCards || null
        });
        
        console.log('✅ Message saved to database');
    } catch (error) {
        console.error('❌ Error saving message to database:', error);
    }
});

// Enhanced error handling with logging
const { logger } = require('./utils/logger');

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    // Log to database or external monitoring service
    console.error('❌ UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    console.error('❌ UNCAUGHT EXCEPTION:', error);
    
    // Attempt graceful shutdown
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    gracefulShutdown('SIGINT');
});

// Graceful shutdown handler
async function gracefulShutdown(signal) {
    console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
    
    try {
        // Close all WhatsApp clients
        console.log('📱 Closing WhatsApp clients...');
        
        // Close legacy client
        if (client) {
            await client.destroy().catch(err => 
                console.error('Error destroying legacy client:', err)
            );
        }
        
        // Close all multi-account sessions
        const sessions = phoneSessionManager.getAllSessions();
        for (const session of sessions) {
            try {
                await phoneSessionManager.removeSession(session.phone_id);
            } catch (err) {
                console.error(`Error closing session ${session.phone_id}:`, err);
            }
        }
        
        // Close database connections
        console.log('💾 Closing database connections...');
        await sequelize.close();
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
}

// --- ROUTES ---

// Reject a WhatsApp call
app.post('/reject-call', legacyAuthMiddleware, async (req, res) => {
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ error: 'Missing callId' });
    res.status(501).json({ error: 'Rejecting calls by ID is not supported in whatsapp-web.js API' });
});

// Send Reaction to a message
app.post('/send-reaction', legacyAuthMiddleware, async (req, res) => {
    const { to, msgId, reaction } = req.body;
    if (!to || !msgId || !reaction) return res.status(400).json({ error: 'Missing required fields' });
    try {
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        const message = await client.getMessageById(msgId);
        await message.react(reaction);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Webhook for incoming messages
app.post('/webhook', (req, res) => {
    res.sendStatus(200);
});

// Get QR code
app.get('/qr', async (req, res) => {
    try {
        // If already authenticated, no QR needed
        if (clientReady) {
            return res.status(200).json({ 
                authenticated: true, 
                message: 'Already authenticated - no QR code needed' 
            });
        }
        
        // If QR not generated yet
        if (!qrCodeData) {
            return res.status(404).json({ 
                error: 'QR code not generated yet', 
                message: 'Please wait, initializing WhatsApp client...' 
            });
        }
        
        // Generate QR code image
        const qrImage = await qrcode.toDataURL(qrCodeData);
        res.json({ 
            qr: qrImage,
            message: 'Scan this QR code with WhatsApp to login'
        });
    } catch (error) {
        logger.error('Error generating QR code:', error);
        console.error('Error generating QR code:', error);
        res.status(500).json({ 
            error: 'Failed to generate QR code',
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await sequelize.authenticate();
        const dbStatus = 'connected';
        
        // Get session information
        const allSessions = phoneSessionManager.getAllSessions();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                unit: 'MB'
            },
            database: dbStatus,
            legacy_client: {
                ready: clientReady,
                has_qr: !!qrCodeData
            },
            multi_account: {
                total_sessions: allSessions.length,
                connected: allSessions.filter(s => s.status === 'connected').length
            }
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// --- MULTI-ACCOUNT STATUS AND INFO ---

// Get system status (shows both legacy and multi-account status)
app.get('/status', async (req, res) => {
    try {
        // Legacy client status
        const legacyStatus = {
            ready: clientReady,
            hasQR: !!qrCodeData,
            message: clientReady ? 'Legacy WhatsApp is connected' : 'Legacy client waiting for authentication'
        };

        // Multi-account status
        const allSessions = phoneSessionManager.getAllSessions();
        const multiAccountStatus = {
            total_accounts: allSessions.length,
            connected_accounts: allSessions.filter(s => s.status === 'connected').length,
            pending_accounts: allSessions.filter(s => s.status === 'pending').length,
            accounts: allSessions
        };

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            legacy_client: legacyStatus,
            multi_account: multiAccountStatus,
            api_info: {
                legacy_endpoints: ['/send-message', '/send-media', '/create-group'],
                multi_account_endpoints: ['/api/v2/send-message', '/api/v2/send-media', '/api/v2/create-group'],
                account_management: ['/api/accounts/create', '/api/accounts/{phone_id}/qr', '/api/accounts/{phone_id}/status']
            }
        });
    } catch (error) {
        console.error('❌ Error getting status:', error);
        res.status(500).json({
            error: 'Failed to get status',
            message: error.message
        });
    }
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
    res.json({
        name: 'WhatsApp Multi-Account API',
        version: '2.0.0',
        description: 'WhatsApp automation with multiple account support',
        endpoints: {
            account_management: {
                create_account: {
                    method: 'POST',
                    path: '/api/accounts/create',
                    body: {
                        phone_id: 'string (required)',
                        name: 'string (optional)',
                        webhook_url: 'string (optional)',
                        webhook_events: 'array (optional)'
                    },
                    response: {
                        success: true,
                        account: {
                            phone_id: 'string',
                            token: 'string',
                            status: 'pending'
                        }
                    }
                },
                get_qr: {
                    method: 'GET',
                    path: '/api/accounts/{phone_id}/qr',
                    response: {
                        success: true,
                        qr_code: 'base64_image_string'
                    }
                },
                get_status: {
                    method: 'GET',
                    path: '/api/accounts/{phone_id}/status',
                    response: {
                        success: true,
                        account: {
                            phone_id: 'string',
                            status: 'connected|pending|disconnected|failed'
                        }
                    }
                }
            },
            messaging: {
                send_message: {
                    method: 'POST',
                    path: '/api/v2/send-message',
                    headers: {
                        phone_id: 'string (required)',
                        token: 'string (required)'
                    },
                    body: {
                        to: 'string (phone number)',
                        message: 'string'
                    }
                },
                send_media: {
                    method: 'POST',
                    path: '/api/v2/send-media',
                    headers: {
                        phone_id: 'string (required)',
                        token: 'string (required)'
                    },
                    body: 'multipart/form-data',
                    fields: {
                        to: 'string (phone number)',
                        file: 'file',
                        caption: 'string (optional)'
                    }
                }
            }
        },
        usage_example: {
            '1_create_account': {
                url: 'POST /api/accounts/create',
                data: {
                    phone_id: 'my_phone_1',
                    name: 'My Business Account'
                }
            },
            '2_get_qr_code': {
                url: 'GET /api/accounts/my_phone_1/qr',
                description: 'Scan the returned QR code with WhatsApp'
            },
            '3_send_message': {
                url: 'POST /api/v2/send-message',
                headers: {
                    phone_id: 'my_phone_1',
                    token: 'your_account_token'
                },
                data: {
                    to: '1234567890',
                    message: 'Hello from multi-account API!'
                }
            }
        }
    });
});

// Send text message
app.post('/send-message', legacyAuthMiddleware, async (req, res) => {
    const { to, message } = req.body;
    
    // Validate input
    if (!to || !message) {
        return res.status(400).json({ error: 'Missing to or message' });
    }
    
    // Check if client is ready
    if (!clientReady) {
        return res.status(503).json({ 
            error: 'WhatsApp client not ready',
            message: 'Please wait for WhatsApp to connect or scan QR code'
        });
    }
    
    try {
        // Format phone number
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        
        // Send message
        await client.sendMessage(chatId, message);
        
        console.log(`✅ Message sent to ${chatId}`);
        res.json({ 
            success: true,
            message: 'Message sent successfully',
            to: chatId
        });
    } catch (err) {
        console.error('❌ Error sending message:', err);
        res.status(500).json({ 
            error: 'Failed to send message',
            details: err.message 
        });
    }
});

// Send media/file
app.post('/send-media', legacyAuthMiddleware, upload.single('file'), async (req, res) => {
    const { to, caption } = req.body;
    
    // Validate input
    if (!to || !req.file) {
        return res.status(400).json({ error: 'Missing to or file' });
    }
    
    // Check if client is ready
    if (!clientReady) {
        return res.status(503).json({ 
            error: 'WhatsApp client not ready',
            message: 'Please wait for WhatsApp to connect or scan QR code'
        });
    }
    
    try {
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        const media = fs.readFileSync(req.file.path);
        const { MessageMedia } = require('whatsapp-web.js');
        const mimeType = req.file.mimetype;
        const filename = req.file.originalname;
        
        const messageMedia = new MessageMedia(mimeType, media.toString('base64'), filename);
        await client.sendMessage(chatId, messageMedia, { caption: caption || '' });
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        console.log(`✅ Media sent to ${chatId}`);
        res.json({ 
            success: true,
            message: 'Media sent successfully',
            to: chatId,
            filename: filename
        });
    } catch (err) {
        console.error('❌ Error sending media:', err);
        // Clean up uploaded file on error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupErr) {
                console.error('Error cleaning up file:', cleanupErr);
            }
        }
        res.status(500).json({ 
            error: 'Failed to send media',
            details: err.message 
        });
    }
});

// Group management example: create group
app.post('/create-group', legacyAuthMiddleware, async (req, res) => {
    const { name, participants } = req.body;
    
    // Validate input
    if (!name || !Array.isArray(participants)) {
        return res.status(400).json({ error: 'Missing name or participants array' });
    }
    
    // Check if client is ready
    if (!clientReady) {
        return res.status(503).json({ 
            error: 'WhatsApp client not ready',
            message: 'Please wait for WhatsApp to connect or scan QR code'
        });
    }
    
    try {
        // Format participant numbers
        const formattedParticipants = participants.map(p => 
            p.includes('@c.us') ? p : `${p}@c.us`
        );
        
        const group = await client.createGroup(name, formattedParticipants);
        
        console.log(`✅ Group created: ${name}`);
        res.json({ 
            success: true,
            group: group,
            message: 'Group created successfully'
        });
    } catch (err) {
        console.error('❌ Error creating group:', err);
        res.status(500).json({ 
            error: 'Failed to create group',
            details: err.message 
        });
    }
});

// --- ACCOUNT ---
app.get('/account/settings', async (req, res) => {
    // Placeholder: Return WhatsApp account settings
    res.json({ message: 'Account settings endpoint' });
});
app.get('/account/state', async (req, res) => {
    res.json({ message: 'Account state endpoint' });
});
app.post('/account/reboot', async (req, res) => {
    res.json({ message: 'Reboot endpoint (not supported in whatsapp-web.js)' });
});
app.post('/account/logout', async (req, res) => {
    try {
        if (client) {
            await client.logout();
            await client.destroy();
            clientReady = false;
            client = null;
        }
        res.send('✅ Logged out successfully. Client destroyed and session cleared.');
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).send('❌ Error during logout: ' + error.message);
    }
});

// --- SENDING ---
// /send-message and /send-media already implemented

// Send Poll (not supported in whatsapp-web.js)
app.post('/send-poll', async (req, res) => {
    res.status(501).json({ error: 'SendPoll not supported in whatsapp-web.js' });
});

// Send file by URL
app.post('/send-file-by-url', legacyAuthMiddleware, async (req, res) => {
    const { to, url, caption } = req.body;
    if (!to || !url) return res.status(400).json({ error: 'Missing to or url' });
    try {
        const { MessageMedia } = require('whatsapp-web.js');
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const mimeType = response.headers['content-type'];
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        const fileName = url.split('/').pop();
        const media = new MessageMedia(mimeType, base64, fileName);
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        await client.sendMessage(chatId, media, { caption });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload file (just saves file, doesn't send)
app.post('/upload-file', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });
    res.json({ file: req.file });
});

// Send location (already implemented as /send-location)
app.post('/send-location', legacyAuthMiddleware, async (req, res) => {
    const { to, latitude, longitude, description } = req.body;
    if (!to || !latitude || !longitude) return res.status(400).json({ error: 'Missing params' });
    try {
        const { Location } = require('whatsapp-web.js');
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        
        const location = new Location(parseFloat(latitude), parseFloat(longitude), description || '');
        await client.sendMessage(chatId, location);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send contact
app.post('/send-contact', legacyAuthMiddleware, async (req, res) => {
    const { to, contactId } = req.body;
    if (!to || !contactId) return res.status(400).json({ error: 'Missing to or contactId' });
    try {
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        const contactToSendId = contactId.includes('@c.us') ? contactId : `${contactId}@c.us`;
        
        // Get the contact object
        const contact = await client.getContactById(contactToSendId);
        
        // Send the contact as a vCard
        await client.sendMessage(chatId, contact);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send interactive buttons (not supported in whatsapp-web.js)
app.post('/send-interactive-buttons', async (req, res) => {
    res.status(501).json({ error: 'SendInteractiveButtons not supported in whatsapp-web.js' });
});

// Send interactive buttons reply (not supported in whatsapp-web.js)
app.post('/send-interactive-buttons-reply', async (req, res) => {
    res.status(501).json({ error: 'SendInteractiveButtonsReply not supported in whatsapp-web.js' });
});

// Forward messages
app.post('/forward-messages', legacyAuthMiddleware, async (req, res) => {
    const { to, messageIds } = req.body;
    if (!to || !Array.isArray(messageIds)) return res.status(400).json({ error: 'Missing to or messageIds' });
    try {
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        for (const msgId of messageIds) {
            const msg = await client.getMessageById(msgId);
            await msg.forward(chatId);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- RECEIVING ---
app.get('/messages/incoming', async (req, res) => {
    // Placeholder: Would require message storage
    res.json({ message: 'Incoming messages endpoint' });
});

// --- JOURNALS ---
app.get('/journals/chat-history', async (req, res) => {
    // Placeholder: Would require message storage
    res.json({ message: 'Chat history endpoint' });
});

// --- QUEUE ---
app.get('/queue/messages', async (req, res) => {
    // Placeholder: Would require queue implementation
    res.json({ message: 'Queue messages endpoint' });
});

// --- GROUPS ---
// CreateGroup already implemented as /create-group

app.post('/groups/update-name', legacyAuthMiddleware, async (req, res) => {
    const { groupId, name } = req.body;
    if (!groupId || !name) return res.status(400).json({ error: 'Missing params' });
    try {
        const chat = await client.getChatById(groupId);
        await chat.setSubject(name);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/groups/update-settings', legacyAuthMiddleware, async (req, res) => {
    const { groupId, settings } = req.body;
    // settings: { sendMessages: true/false, editInfo: true/false }
    if (!groupId || !settings) return res.status(400).json({ error: 'Missing params' });
    try {
        const chat = await client.getChatById(groupId);
        if (settings.sendMessages !== undefined) await chat.setMessagesAdminsOnly(!settings.sendMessages);
        if (settings.editInfo !== undefined) await chat.setInfoAdminsOnly(settings.editInfo);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all groups
app.get('/groups', async (req, res) => {
    // Check if client is ready
    if (!clientReady) {
        return res.status(503).json({ 
            error: 'WhatsApp client not ready',
            message: 'Please wait for WhatsApp to connect or scan QR code'
        });
    }
    
    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup).map(group => ({
            id: group.id._serialized,
            name: group.name,
            participantCount: group.participants ? group.participants.length : 0,
            timestamp: group.timestamp,
            unreadCount: group.unreadCount || 0,
            archived: group.archived || false,
            pinned: group.pinned || false
        }));
        
        console.log(`✅ Found ${groups.length} groups`);
        res.json({ 
            success: true,
            groups: groups,
            total: groups.length
        });
    } catch (err) {
        console.error('❌ Error fetching groups:', err);
        res.status(500).json({ 
            error: 'Failed to fetch groups',
            details: err.message 
        });
    }
});

app.get('/groups/data/:groupId', async (req, res) => {
    // Check if client is ready
    if (!clientReady) {
        return res.status(503).json({ 
            error: 'WhatsApp client not ready',
            message: 'Please wait for WhatsApp to connect or scan QR code'
        });
    }
    
    try {
        const chat = await client.getChatById(req.params.groupId);
        
        if (!chat.isGroup) {
            return res.status(400).json({ error: 'This is not a group chat' });
        }
        
        // Get detailed participant information
        const participants = chat.participants.map(p => ({
            id: p.id._serialized,
            number: p.id.user,
            isAdmin: p.isAdmin,
            isSuperAdmin: p.isSuperAdmin
        }));
        
        // Get contact info for each participant
        const participantsWithDetails = await Promise.all(
            participants.map(async (p) => {
                try {
                    const contact = await client.getContactById(p.id);
                    return {
                        ...p,
                        name: contact.name || contact.pushname || p.number,
                        pushname: contact.pushname,
                        isMyContact: contact.isMyContact,
                        profilePicUrl: await contact.getProfilePicUrl().catch(() => null)
                    };
                } catch (err) {
                    return {
                        ...p,
                        name: p.number,
                        pushname: null,
                        isMyContact: false,
                        profilePicUrl: null
                    };
                }
            })
        );
        
        const groupData = {
            id: chat.id._serialized,
            name: chat.name,
            description: chat.groupMetadata?.desc || '',
            owner: chat.groupMetadata?.owner?._serialized || null,
            createdAt: chat.groupMetadata?.creation || null,
            participantCount: participants.length,
            participants: participantsWithDetails,
            unreadCount: chat.unreadCount || 0,
            archived: chat.archived || false,
            pinned: chat.pinned || false
        };
        
        console.log(`✅ Fetched details for group: ${chat.name}`);
        res.json({ 
            success: true,
            group: groupData
        });
    } catch (err) {
        console.error('❌ Error fetching group data:', err);
        res.status(500).json({ 
            error: 'Failed to fetch group data',
            details: err.message 
        });
    }
});

app.post('/groups/add-participant', legacyAuthMiddleware, async (req, res) => {
    const { groupId, participant } = req.body;
    
    if (!groupId || !participant) {
        return res.status(400).json({ error: 'Missing groupId or participant' });
    }
    
    if (!clientReady) {
        return res.status(503).json({ 
            error: 'WhatsApp client not ready',
            message: 'Please wait for WhatsApp to connect or scan QR code'
        });
    }
    
    try {
        const chat = await client.getChatById(groupId);
        const participantId = participant.includes('@c.us') ? participant : `${participant}@c.us`;
        
        await chat.addParticipants([participantId]);
        
        console.log(`✅ Added participant ${participantId} to group ${chat.name}`);
        res.json({ 
            success: true,
            message: 'Participant added successfully'
        });
    } catch (err) {
        console.error('❌ Error adding participant:', err);
        res.status(500).json({ 
            error: 'Failed to add participant',
            details: err.message 
        });
    }
});

app.post('/groups/remove-participant', legacyAuthMiddleware, async (req, res) => {
    const { groupId, participant } = req.body;
    
    if (!groupId || !participant) {
        return res.status(400).json({ error: 'Missing groupId or participant' });
    }
    
    if (!clientReady) {
        return res.status(503).json({ 
            error: 'WhatsApp client not ready',
            message: 'Please wait for WhatsApp to connect or scan QR code'
        });
    }
    
    try {
        const chat = await client.getChatById(groupId);
        await chat.removeParticipants([participant]);
        
        console.log(`✅ Removed participant ${participant} from group ${chat.name}`);
        res.json({ 
            success: true,
            message: 'Participant removed successfully'
        });
    } catch (err) {
        console.error('❌ Error removing participant:', err);
        res.status(500).json({ 
            error: 'Failed to remove participant',
            details: err.message 
        });
    }
});

app.post('/groups/set-admin', legacyAuthMiddleware, async (req, res) => {
    const { groupId, participant } = req.body;
    if (!groupId || !participant) return res.status(400).json({ error: 'Missing params' });
    try {
        const chat = await client.getChatById(groupId);
        await chat.promoteParticipants([participant]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/groups/remove-admin', legacyAuthMiddleware, async (req, res) => {
    const { groupId, participant } = req.body;
    if (!groupId || !participant) return res.status(400).json({ error: 'Missing params' });
    try {
        const chat = await client.getChatById(groupId);
        await chat.demoteParticipants([participant]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/groups/set-picture', async (req, res) => {
    // Not supported in whatsapp-web.js as of now
    res.status(501).json({ error: 'SetGroupPicture not supported in whatsapp-web.js' });
});

app.post('/groups/leave', legacyAuthMiddleware, async (req, res) => {
    const { groupId } = req.body;
    if (!groupId) return res.status(400).json({ error: 'Missing groupId' });
    try {
        const chat = await client.getChatById(groupId);
        await chat.leave();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- STATUSES ---
app.get('/statuses', async (req, res) => {
    // Placeholder: whatsapp-web.js does not support status retrieval
    res.json({ message: 'Statuses endpoint' });
});

// --- READ MARK ---
app.post('/read-mark', legacyAuthMiddleware, async (req, res) => {
    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ error: 'Missing chatId' });
    try {
        const chat = await client.getChatById(chatId);
        await chat.sendSeen();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SERVICE METHODS ---
app.get('/service/contacts', async (req, res) => {
    try {
        const contacts = await client.getContacts();
        res.json({ contacts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/service/avatar/:id', async (req, res) => {
    try {
        const url = await client.getProfilePicUrl(req.params.id);
        res.json({ url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PARTNER METHODS ---
app.get('/partner/instances', async (req, res) => {
    // Placeholder: Not supported in whatsapp-web.js
    res.json({ message: 'Partner instances endpoint' });
});

// --- DATABASE ENDPOINTS ---
app.get('/database/messages', async (req, res) => {
    try {
        const { limit = 50, offset = 0, chatId } = req.query;
        const where = chatId ? { to: chatId } : {};
        
        const messages = await Message.findAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['timestamp', 'DESC']]
        });
        
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/database/contacts', async (req, res) => {
    try {
        const contacts = await Contact.findAll({
            order: [['name', 'ASC']]
        });
        res.json({ contacts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/database/chats', async (req, res) => {
    try {
        const chats = await Chat.findAll({
            order: [['timestamp', 'DESC']]
        });
        res.json({ chats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/database/groups', async (req, res) => {
    try {
        const groups = await Group.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json({ groups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/database/stats', async (req, res) => {
    try {
        const stats = {
            totalMessages: await Message.count(),
            totalContacts: await Contact.count(),
            totalChats: await Chat.count(),
            totalGroups: await Group.count(),
            recentMessages: await Message.count({
                where: {
                    timestamp: {
                        [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            })
        };
        res.json({ stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Message Logs API Endpoints
app.get('/api/messages/logs', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { 
            page = 1, 
            limit = 20, 
            direction, 
            type, 
            chatType, 
            search, 
            dateFrom, 
            dateTo, 
            sort = 'desc' 
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const where = {};

        // Filter by direction (sent/received)
        if (direction === 'sent') {
            where.fromMe = true;
        } else if (direction === 'received') {
            where.fromMe = false;
        }

        // Filter by message type
        if (type) {
            where.type = type;
        }

        // Filter by chat type (individual/group)
        if (chatType === 'group') {
            where.isGroupMsg = true;
        } else if (chatType === 'individual') {
            where.isGroupMsg = false;
        }

        // Search in message body
        if (search) {
            where.body = {
                [Op.iLike]: `%${search}%`
            };
        }

        // Date range filter
        if (dateFrom || dateTo) {
            where.timestamp = {};
            if (dateFrom) {
                where.timestamp[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                where.timestamp[Op.lte] = toDate;
            }
        }

        // Get messages with pagination
        const { count, rows } = await Message.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: offset,
            order: [['timestamp', sort.toUpperCase()]],
            attributes: [
                'id', 'messageId', 'from', 'to', 'body', 'type', 
                'timestamp', 'isGroupMsg', 'author', 'quotedMsgId', 
                'mediaData', 'location', 'vCards', 'isForwarded', 
                'forwardingScore', 'isStatus', 'isStarred', 'fromMe'
            ]
        });

        const totalPages = Math.ceil(count / parseInt(limit));

        res.json({
            success: true,
            messages: rows,
            total: count,
            page: parseInt(page),
            totalPages: totalPages,
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching message logs:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Message Stats API Endpoint
app.get('/api/messages/stats', async (req, res) => {
    try {
        const total = await Message.count();
        const sent = await Message.count({ where: { fromMe: true } });
        const received = await Message.count({ where: { fromMe: false } });
        const group = await Message.count({ where: { isGroupMsg: true } });

        res.json({
            success: true,
            stats: {
                total,
                sent,
                received,
                group
            }
        });
    } catch (error) {
        console.error('Error fetching message stats:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Export Messages to CSV
app.get('/api/messages/export', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { 
            direction, 
            type, 
            chatType, 
            search, 
            dateFrom, 
            dateTo 
        } = req.query;

        const where = {};

        // Apply same filters as logs endpoint
        if (direction === 'sent') {
            where.fromMe = true;
        } else if (direction === 'received') {
            where.fromMe = false;
        }

        if (type) {
            where.type = type;
        }

        if (chatType === 'group') {
            where.isGroupMsg = true;
        } else if (chatType === 'individual') {
            where.isGroupMsg = false;
        }

        if (search) {
            where.body = {
                [Op.iLike]: `%${search}%`
            };
        }

        if (dateFrom || dateTo) {
            where.timestamp = {};
            if (dateFrom) {
                where.timestamp[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                where.timestamp[Op.lte] = toDate;
            }
        }

        const messages = await Message.findAll({
            where,
            order: [['timestamp', 'DESC']],
            limit: 10000 // Limit export to 10k messages
        });

        // Generate CSV
        let csv = 'Timestamp,Direction,Type,From,To,Body,Group,Author,Forwarded,Starred\n';
        
        messages.forEach(msg => {
            const timestamp = new Date(msg.timestamp).toISOString();
            const direction = msg.fromMe ? 'Sent' : 'Received';
            const body = (msg.body || '').replace(/"/g, '""').replace(/\n/g, ' ');
            const from = msg.from.replace('@c.us', '').replace('@g.us', '');
            const to = msg.to.replace('@c.us', '').replace('@g.us', '');
            const author = msg.author ? msg.author.replace('@c.us', '').replace('@g.us', '') : '';
            
            csv += `"${timestamp}","${direction}","${msg.type}","${from}","${to}","${body}","${msg.isGroupMsg}","${author}","${msg.isForwarded}","${msg.isStarred}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=message-logs-${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting messages:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Start server with database initialization
// Expose client globally for bulk messaging services (legacy)
global.whatsappClient = client;

const startServer = async () => {
    try {
        // Test database connection
        await testConnection();
        
        // Sync database tables (including new WhatsAppAccount table)
        await sequelize.sync({ force: false });
        console.log('✅ Database tables synchronized');
        
        // Initialize webhook service
        await webhookService.initialize();
        console.log('✅ Webhook service initialized');
        
        // Initialize legacy WhatsApp client (for backward compatibility)
        client.initialize();
        
        // Initialize multi-account phone session manager
        console.log('🔄 Initializing multi-account phone session manager...');
        await phoneSessionManager.initialize();
        console.log('✅ Multi-account phone session manager initialized');
        
        // Start Express server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌐 Web interface: http://localhost:${PORT}`);
            console.log(`📱 Legacy QR Code: http://localhost:${PORT}/qr`);
            console.log(`� Account Management: http://localhost:${PORT}/account.html`);
            console.log(`�🗄️ Database: PostgreSQL connected`);
            console.log('');
            console.log('📋 API Endpoints:');
            console.log('   📊 Account Management: /api/accounts/*');
            console.log('   📤 Multi-Account API: /api/v2/*');
            console.log('   🔗 Legacy API: /send-message, /send-media, etc.');
            console.log('');
            console.log('🎯 Multi-Account Usage:');
            console.log('   1. Create account: POST /api/accounts/create');
            console.log('   2. Get QR code: GET /api/accounts/{phone_id}/qr');
            console.log('   3. Use API with headers: phone_id, token');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
