const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const { apiKeyAuth, requirePermission } = require('../middleware/apiAuth');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

/**
 * Helper function to get WhatsApp client
 */
function getClient() {
    return global.whatsappClient;
}

/**
 * Helper function to check if client is ready
 */
function isClientReady(res) {
    const client = getClient();
    if (!client || !global.whatsappReady) {
        res.status(503).json({
            success: false,
            error: 'Service unavailable',
            message: 'WhatsApp client is not connected. Please scan QR code first.',
            ready: false
        });
        return false;
    }
    return true;
}

/**
 * Standard API response wrapper
 */
function apiResponse(success, data = {}, message = null) {
    const response = { success };
    if (message) response.message = message;
    return { ...response, ...data };
}

// ============================================
// STATUS & HEALTH CHECK ENDPOINTS
// ============================================

/**
 * @route GET /api/external/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
    res.json(apiResponse(true, {
        status: 'operational',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    }));
});

/**
 * @route GET /api/external/status
 * @desc Get WhatsApp connection status
 * @access Public (with optional API key)
 */
router.get('/status', (req, res) => {
    const ready = global.whatsappReady || false;
    res.json(apiResponse(true, {
        connected: ready,
        ready: ready,
        timestamp: new Date().toISOString()
    }, ready ? 'WhatsApp is connected' : 'WhatsApp is not connected'));
});

// ============================================
// MESSAGING ENDPOINTS (Protected)
// ============================================

/**
 * @route POST /api/external/send-message
 * @desc Send a text message
 * @access Protected (API Key + sendMessage permission)
 */
router.post('/send-message', apiKeyAuth, requirePermission('sendMessage'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const { to, message, mentions } = req.body;

        // Validate input
        if (!to || !message) {
            return res.status(400).json(apiResponse(false, {
                error: 'Missing required fields'
            }, 'Both "to" and "message" fields are required'));
        }

        const client = getClient();
        const chatId = to.includes('@') ? to : `${to}@c.us`;

        // Send message with optional mentions
        const options = {};
        if (mentions && Array.isArray(mentions)) {
            options.mentions = mentions.map(m => m.includes('@') ? m : `${m}@c.us`);
        }

        const sentMessage = await client.sendMessage(chatId, message, options);

        console.log(`✅ [API] Message sent to ${chatId} via API key: ${req.apiKey.name}`);

        res.json(apiResponse(true, {
            messageId: sentMessage.id._serialized,
            to: chatId,
            timestamp: new Date(sentMessage.timestamp * 1000).toISOString()
        }, 'Message sent successfully'));

    } catch (error) {
        console.error('❌ [API] Error sending message:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to send message'));
    }
});

/**
 * @route POST /api/external/send-media
 * @desc Send media/file with optional caption
 * @access Protected (API Key + sendMedia permission)
 */
router.post('/send-media', apiKeyAuth, requirePermission('sendMedia'), upload.single('file'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const { to, caption } = req.body;

        if (!to || !req.file) {
            return res.status(400).json(apiResponse(false, {
                error: 'Missing required fields'
            }, 'Both "to" and "file" are required'));
        }

        const client = getClient();
        const { MessageMedia } = require('whatsapp-web.js');
        const chatId = to.includes('@') ? to : `${to}@c.us`;

        // Read file and create MessageMedia
        const media = fs.readFileSync(req.file.path);
        const messageMedia = new MessageMedia(
            req.file.mimetype,
            media.toString('base64'),
            req.file.originalname
        );

        // Send media
        const sentMessage = await client.sendMessage(chatId, messageMedia, { 
            caption: caption || '' 
        });

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        console.log(`✅ [API] Media sent to ${chatId} via API key: ${req.apiKey.name}`);

        res.json(apiResponse(true, {
            messageId: sentMessage.id._serialized,
            to: chatId,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            timestamp: new Date(sentMessage.timestamp * 1000).toISOString()
        }, 'Media sent successfully'));

    } catch (error) {
        console.error('❌ [API] Error sending media:', error);
        // Clean up file on error
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to send media'));
    }
});

/**
 * @route POST /api/external/send-file-url
 * @desc Send file from URL
 * @access Protected (API Key + sendMedia permission)
 */
router.post('/send-file-url', apiKeyAuth, requirePermission('sendMedia'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const { to, url, caption, filename } = req.body;

        if (!to || !url) {
            return res.status(400).json(apiResponse(false, {
                error: 'Missing required fields'
            }, 'Both "to" and "url" are required'));
        }

        const client = getClient();
        const { MessageMedia } = require('whatsapp-web.js');
        const chatId = to.includes('@') ? to : `${to}@c.us`;

        // Download file from URL
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const mimeType = response.headers['content-type'];
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        const fileName = filename || url.split('/').pop();

        const media = new MessageMedia(mimeType, base64, fileName);
        const sentMessage = await client.sendMessage(chatId, media, { caption: caption || '' });

        console.log(`✅ [API] File from URL sent to ${chatId} via API key: ${req.apiKey.name}`);

        res.json(apiResponse(true, {
            messageId: sentMessage.id._serialized,
            to: chatId,
            filename: fileName,
            mimetype: mimeType,
            timestamp: new Date(sentMessage.timestamp * 1000).toISOString()
        }, 'File sent successfully'));

    } catch (error) {
        console.error('❌ [API] Error sending file from URL:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to send file from URL'));
    }
});

/**
 * @route POST /api/external/send-location
 * @desc Send location
 * @access Protected (API Key + sendLocation permission)
 */
router.post('/send-location', apiKeyAuth, requirePermission('sendLocation'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const { to, latitude, longitude, description } = req.body;

        if (!to || !latitude || !longitude) {
            return res.status(400).json(apiResponse(false, {
                error: 'Missing required fields'
            }, 'Fields "to", "latitude", and "longitude" are required'));
        }

        const client = getClient();
        const { Location } = require('whatsapp-web.js');
        const chatId = to.includes('@') ? to : `${to}@c.us`;

        const location = new Location(
            parseFloat(latitude), 
            parseFloat(longitude), 
            description || ''
        );

        const sentMessage = await client.sendMessage(chatId, location);

        console.log(`✅ [API] Location sent to ${chatId} via API key: ${req.apiKey.name}`);

        res.json(apiResponse(true, {
            messageId: sentMessage.id._serialized,
            to: chatId,
            location: { latitude, longitude, description },
            timestamp: new Date(sentMessage.timestamp * 1000).toISOString()
        }, 'Location sent successfully'));

    } catch (error) {
        console.error('❌ [API] Error sending location:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to send location'));
    }
});

/**
 * @route POST /api/external/send-contact
 * @desc Send contact vCard
 * @access Protected (API Key + sendContact permission)
 */
router.post('/send-contact', apiKeyAuth, requirePermission('sendContact'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const { to, contactId } = req.body;

        if (!to || !contactId) {
            return res.status(400).json(apiResponse(false, {
                error: 'Missing required fields'
            }, 'Both "to" and "contactId" are required'));
        }

        const client = getClient();
        const chatId = to.includes('@') ? to : `${to}@c.us`;
        const contactToSendId = contactId.includes('@') ? contactId : `${contactId}@c.us`;

        // Get contact and send as vCard
        const contact = await client.getContactById(contactToSendId);
        const sentMessage = await client.sendMessage(chatId, contact);

        console.log(`✅ [API] Contact sent to ${chatId} via API key: ${req.apiKey.name}`);

        res.json(apiResponse(true, {
            messageId: sentMessage.id._serialized,
            to: chatId,
            contactSent: contactToSendId,
            timestamp: new Date(sentMessage.timestamp * 1000).toISOString()
        }, 'Contact sent successfully'));

    } catch (error) {
        console.error('❌ [API] Error sending contact:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to send contact'));
    }
});

/**
 * @route POST /api/external/send-reaction
 * @desc Send reaction to a message
 * @access Protected (API Key + sendReaction permission)
 */
router.post('/send-reaction', apiKeyAuth, requirePermission('sendReaction'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const { messageId, reaction } = req.body;

        if (!messageId || !reaction) {
            return res.status(400).json(apiResponse(false, {
                error: 'Missing required fields'
            }, 'Both "messageId" and "reaction" are required'));
        }

        const client = getClient();
        const message = await client.getMessageById(messageId);
        await message.react(reaction);

        console.log(`✅ [API] Reaction sent via API key: ${req.apiKey.name}`);

        res.json(apiResponse(true, {
            messageId: messageId,
            reaction: reaction,
            timestamp: new Date().toISOString()
        }, 'Reaction sent successfully'));

    } catch (error) {
        console.error('❌ [API] Error sending reaction:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to send reaction'));
    }
});

// ============================================
// GROUP MANAGEMENT ENDPOINTS (Protected)
// ============================================

/**
 * @route POST /api/external/create-group
 * @desc Create a new WhatsApp group
 * @access Protected (API Key + createGroup permission)
 */
router.post('/create-group', apiKeyAuth, requirePermission('createGroup'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const { name, participants } = req.body;

        if (!name || !Array.isArray(participants) || participants.length === 0) {
            return res.status(400).json(apiResponse(false, {
                error: 'Invalid request'
            }, 'Field "name" and "participants" array are required'));
        }

        const client = getClient();
        const formattedParticipants = participants.map(p => 
            p.includes('@') ? p : `${p}@c.us`
        );

        const group = await client.createGroup(name, formattedParticipants);

        console.log(`✅ [API] Group created via API key: ${req.apiKey.name}`);

        res.json(apiResponse(true, {
            groupId: group.gid._serialized,
            name: name,
            participants: formattedParticipants.length
        }, 'Group created successfully'));

    } catch (error) {
        console.error('❌ [API] Error creating group:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to create group'));
    }
});

/**
 * @route GET /api/external/groups
 * @desc Get all groups
 * @access Protected (API Key + manageGroups permission)
 */
router.get('/groups', apiKeyAuth, requirePermission('manageGroups'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const client = getClient();
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup).map(group => ({
            id: group.id._serialized,
            name: group.name,
            participantCount: group.participants ? group.participants.length : 0,
            timestamp: group.timestamp,
            unreadCount: group.unreadCount || 0
        }));

        res.json(apiResponse(true, {
            groups: groups,
            total: groups.length
        }));

    } catch (error) {
        console.error('❌ [API] Error fetching groups:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to fetch groups'));
    }
});

/**
 * @route GET /api/external/groups/:groupId
 * @desc Get group details
 * @access Protected (API Key + manageGroups permission)
 */
router.get('/groups/:groupId', apiKeyAuth, requirePermission('manageGroups'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const client = getClient();
        const chat = await client.getChatById(req.params.groupId);

        if (!chat.isGroup) {
            return res.status(400).json(apiResponse(false, {
                error: 'Not a group'
            }, 'The provided ID is not a group'));
        }

        const participants = chat.participants.map(p => ({
            id: p.id._serialized,
            number: p.id.user,
            isAdmin: p.isAdmin,
            isSuperAdmin: p.isSuperAdmin
        }));

        const groupData = {
            id: chat.id._serialized,
            name: chat.name,
            description: chat.groupMetadata?.desc || '',
            owner: chat.groupMetadata?.owner?._serialized || null,
            createdAt: chat.groupMetadata?.creation || null,
            participantCount: participants.length,
            participants: participants
        };

        res.json(apiResponse(true, { group: groupData }));

    } catch (error) {
        console.error('❌ [API] Error fetching group details:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to fetch group details'));
    }
});

/**
 * @route POST /api/external/groups/:groupId/participants
 * @desc Add participant to group
 * @access Protected (API Key + manageGroups permission)
 */
router.post('/groups/:groupId/participants', apiKeyAuth, requirePermission('manageGroups'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const { participant } = req.body;

        if (!participant) {
            return res.status(400).json(apiResponse(false, {
                error: 'Missing participant'
            }, 'Field "participant" is required'));
        }

        const client = getClient();
        const chat = await client.getChatById(req.params.groupId);
        const participantId = participant.includes('@') ? participant : `${participant}@c.us`;

        await chat.addParticipants([participantId]);

        console.log(`✅ [API] Participant added to group via API key: ${req.apiKey.name}`);

        res.json(apiResponse(true, {
            groupId: req.params.groupId,
            participantAdded: participantId
        }, 'Participant added successfully'));

    } catch (error) {
        console.error('❌ [API] Error adding participant:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to add participant'));
    }
});

/**
 * @route DELETE /api/external/groups/:groupId/participants/:participantId
 * @desc Remove participant from group
 * @access Protected (API Key + manageGroups permission)
 */
router.delete('/groups/:groupId/participants/:participantId', apiKeyAuth, requirePermission('manageGroups'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const client = getClient();
        const chat = await client.getChatById(req.params.groupId);
        await chat.removeParticipants([req.params.participantId]);

        console.log(`✅ [API] Participant removed from group via API key: ${req.apiKey.name}`);

        res.json(apiResponse(true, {
            groupId: req.params.groupId,
            participantRemoved: req.params.participantId
        }, 'Participant removed successfully'));

    } catch (error) {
        console.error('❌ [API] Error removing participant:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to remove participant'));
    }
});

// ============================================
// CONTACT & CHAT ENDPOINTS (Protected)
// ============================================

/**
 * @route GET /api/external/contacts
 * @desc Get all contacts
 * @access Protected (API Key + readMessages permission)
 */
router.get('/contacts', apiKeyAuth, requirePermission('readMessages'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const client = getClient();
        const contacts = await client.getContacts();
        
        const formattedContacts = contacts
            .filter(c => !c.isGroup && c.isMyContact)
            .map(contact => ({
                id: contact.id._serialized,
                name: contact.name || contact.pushname,
                number: contact.number,
                pushname: contact.pushname,
                isMyContact: contact.isMyContact
            }));

        res.json(apiResponse(true, {
            contacts: formattedContacts,
            total: formattedContacts.length
        }));

    } catch (error) {
        console.error('❌ [API] Error fetching contacts:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to fetch contacts'));
    }
});

/**
 * @route GET /api/external/chats
 * @desc Get all chats
 * @access Protected (API Key + readMessages permission)
 */
router.get('/chats', apiKeyAuth, requirePermission('readMessages'), async (req, res) => {
    if (!isClientReady(res)) return;

    try {
        const client = getClient();
        const chats = await client.getChats();
        
        const formattedChats = chats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            unreadCount: chat.unreadCount || 0,
            timestamp: chat.timestamp,
            archived: chat.archived || false,
            pinned: chat.pinned || false
        }));

        res.json(apiResponse(true, {
            chats: formattedChats,
            total: formattedChats.length
        }));

    } catch (error) {
        console.error('❌ [API] Error fetching chats:', error);
        res.status(500).json(apiResponse(false, {
            error: error.message
        }, 'Failed to fetch chats'));
    }
});

module.exports = router;
