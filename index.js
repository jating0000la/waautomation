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
const { Message, Contact, Group, Chat, WebhookLog } = require('./models');

// Bulk messaging imports
const bulkRoutes = require('./bulk/routes');
const bulkModels = require('./bulk/models');

// Security middleware imports
const { securityHeaders, apiLimiter, csrfProtection } = require('./middleware/security');

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

// Add bulk messaging routes
app.use('/api/bulk', bulkRoutes);

// WhatsApp client
const client = new Client({
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
            '--disable-gpu'
        ]
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
        await sequelize.sync({ alter: true });
        console.log('✅ Database tables synchronized');
        
        // Initialize bulk messaging models
        const bulkSequelize = require('./bulk/models').sequelize;
        await bulkSequelize.sync({ alter: true });
        console.log('✅ Bulk messaging tables synchronized');
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
    
    // Check for STOP keyword to add to DND list
    if (msg.body && msg.body.trim().toUpperCase() === 'STOP' && !msg.fromMe && !msg.isGroupMsg) {
        try {
            const DND = bulkModels.DND;
            const phoneNumber = msg.from.replace('@c.us', '');
            
            // Check if already in DND
            const existingDND = await DND.findOne({ where: { phone: phoneNumber } });
            
            if (!existingDND) {
                await DND.create({
                    phone: phoneNumber,
                    reason: 'User sent STOP keyword',
                    source: 'STOP_keyword',
                    addedBy: 'system'
                });
                
                console.log(`✅ Added ${phoneNumber} to DND list (STOP keyword received)`);
                
                // Send confirmation message
                await msg.reply('✅ You have been unsubscribed from our messages. You will not receive any more messages from us. To re-subscribe, please contact us directly.');
            } else {
                console.log(`ℹ️ ${phoneNumber} already in DND list`);
                await msg.reply('You are already unsubscribed from our messages.');
            }
        } catch (error) {
            console.error('❌ Error adding to DND list:', error);
        }
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

// Add error handling to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.log('Uncaught Exception:', error);
});

// --- ROUTES ---

// Reject a WhatsApp call
app.post('/reject-call', async (req, res) => {
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ error: 'Missing callId' });
    res.status(501).json({ error: 'Rejecting calls by ID is not supported in whatsapp-web.js API' });
});

// Send Reaction to a message
app.post('/send-reaction', async (req, res) => {
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
        console.error('Error generating QR code:', error);
        res.status(500).json({ 
            error: 'Failed to generate QR code',
            details: error.message 
        });
    }
});

// Get client status
app.get('/status', (req, res) => {
    res.json({ 
        ready: clientReady,
        hasQR: !!qrCodeData,
        message: clientReady ? 'WhatsApp is connected and ready' : 'Waiting for authentication'
    });
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('disconnected', (reason) => {
    clientReady = false;
    global.whatsappReady = false;
    console.log('Client was logged out', reason);
});

// Webhook for incoming messages
app.post('/webhook', (req, res) => {
    // You can process incoming webhook data here
    res.sendStatus(200);
});

// Send text message
app.post('/send-message', async (req, res) => {
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
app.post('/send-media', upload.single('file'), async (req, res) => {
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
app.post('/create-group', async (req, res) => {
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

// Listen for incoming messages and forward to webhook (if needed)
client.on('message', async msg => {
    // You can POST to your webhook here if needed
    console.log('Received message:', msg.body);
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
app.post('/send-file-by-url', async (req, res) => {
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
app.post('/send-location', async (req, res) => {
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
app.post('/send-contact', async (req, res) => {
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
app.post('/forward-messages', async (req, res) => {
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

app.post('/groups/update-name', async (req, res) => {
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

app.post('/groups/update-settings', async (req, res) => {
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

app.post('/groups/add-participant', async (req, res) => {
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

app.post('/groups/remove-participant', async (req, res) => {
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

app.post('/groups/set-admin', async (req, res) => {
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

app.post('/groups/remove-admin', async (req, res) => {
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

app.post('/groups/leave', async (req, res) => {
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
app.post('/read-mark', async (req, res) => {
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

// DND Auto-Add Stats API Endpoint
app.get('/api/dnd/stop-keyword-stats', async (req, res) => {
    try {
        const DND = bulkModels.DND;
        
        const total = await DND.count();
        const stopKeyword = await DND.count({ where: { source: 'STOP_keyword' } });
        const manual = await DND.count({ where: { source: 'manual' } });
        const admin = await DND.count({ where: { source: 'admin' } });
        
        // Get recent STOP keyword additions
        const recentStops = await DND.findAll({
            where: { source: 'STOP_keyword' },
            limit: 10,
            order: [['addedAt', 'DESC']],
            attributes: ['phone', 'reason', 'addedAt']
        });

        res.json({
            success: true,
            stats: {
                total,
                stopKeyword,
                manual,
                admin
            },
            recentStops
        });
    } catch (error) {
        console.error('Error fetching DND stats:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Start server with database initialization
// Expose client globally for bulk messaging services
global.whatsappClient = client;

const startServer = async () => {
    try {
        // Test database connection
        await testConnection();
        
        // Initialize WhatsApp client
        client.initialize();
        
        // Start Express server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌐 Web interface: http://localhost:${PORT}`);
            console.log(`📱 QR Code: http://localhost:${PORT}/qr`);
            console.log(`🗄️ Database: PostgreSQL connected`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
