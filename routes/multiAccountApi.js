const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const { authenticatePhoneAPI, requireSessionReady } = require('../middleware/phoneAuth');
const phoneSessionManager = require('../services/phoneSessionManager');

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Apply authentication middleware to all routes
router.use(authenticatePhoneAPI);

/**
 * Send text message
 * POST /api/v2/send-message
 */
router.post('/send-message', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { to, message } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        // Validate input
        if (!to || !message) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'Both "to" and "message" are required'
            });
        }
        
        // Format phone number
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        
        // Send message
        const sentMessage = await client.sendMessage(chatId, message);
        
        console.log(`✅ Message sent from ${phoneId} to ${chatId}`);
        res.json({ 
            success: true,
            message: 'Message sent successfully',
            phone_id: phoneId,
            to: chatId,
            messageId: sentMessage.id._serialized,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error sending message:', error);
        res.status(500).json({ 
            error: 'Failed to send message',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Send media/file
 * POST /api/v2/send-media
 */
router.post('/send-media', requireSessionReady(phoneSessionManager), upload.single('file'), async (req, res) => {
    let filePath = null;
    
    try {
        const { to, caption } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        // Validate input
        if (!to || !req.file) {
            // Clean up uploaded file if validation fails
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'Both "to" and "file" are required'
            });
        }
        
        filePath = req.file.path;
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        const media = fs.readFileSync(filePath);
        const { MessageMedia } = require('whatsapp-web.js');
        const mimeType = req.file.mimetype;
        const filename = req.file.originalname;
        
        const messageMedia = new MessageMedia(mimeType, media.toString('base64'), filename);
        const sentMessage = await client.sendMessage(chatId, messageMedia, { caption: caption || '' });
        
        // Clean up uploaded file after successful send
        fs.unlinkSync(filePath);
        filePath = null;
        
        console.log(`✅ Media sent from ${phoneId} to ${chatId}`);
        res.json({ 
            success: true,
            message: 'Media sent successfully',
            phone_id: phoneId,
            to: chatId,
            filename: filename,
            messageId: sentMessage.id._serialized,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error sending media:', error);
        
        // Clean up uploaded file on error
        if (filePath) {
            try {
                fs.unlinkSync(filePath);
            } catch (cleanupErr) {
                console.error('Error cleaning up file:', cleanupErr);
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to send media',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Send file by URL
 * POST /api/v2/send-file-by-url
 */
router.post('/send-file-by-url', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { to, url, caption } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!to || !url) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'Both "to" and "url" are required'
            });
        }
        
        const { MessageMedia } = require('whatsapp-web.js');
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const mimeType = response.headers['content-type'];
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        const fileName = url.split('/').pop();
        const media = new MessageMedia(mimeType, base64, fileName);
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        
        const sentMessage = await client.sendMessage(chatId, media, { caption });
        
        res.json({ 
            success: true,
            message: 'File sent successfully',
            phone_id: phoneId,
            to: chatId,
            url: url,
            messageId: sentMessage.id._serialized,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error sending file by URL:', error);
        res.status(500).json({ 
            error: 'Failed to send file',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Send location
 * POST /api/v2/send-location
 */
router.post('/send-location', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { to, latitude, longitude, description } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!to || !latitude || !longitude) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: '"to", "latitude", and "longitude" are required'
            });
        }
        
        const { Location } = require('whatsapp-web.js');
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        
        const location = new Location(parseFloat(latitude), parseFloat(longitude), description || '');
        const sentMessage = await client.sendMessage(chatId, location);
        
        res.json({ 
            success: true,
            message: 'Location sent successfully',
            phone_id: phoneId,
            to: chatId,
            messageId: sentMessage.id._serialized,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error sending location:', error);
        res.status(500).json({ 
            error: 'Failed to send location',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Send contact
 * POST /api/v2/send-contact
 */
router.post('/send-contact', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { to, contactId, contact } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!to) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: '"to" field is required'
            });
        }

        // Check if we're sending an existing contact by ID or creating a new one
        if (!contactId && !contact) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'Either "contactId" (for existing contact) or "contact" object (for new contact) is required'
            });
        }
        
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        let contactToSend;

        if (contactId) {
            // Send existing contact by ID
            const contactToSendId = contactId.includes('@c.us') ? contactId : `${contactId}@c.us`;
            contactToSend = await client.getContactById(contactToSendId);
        } else if (contact) {
            // Create new vCard contact
            const { name, phone, organization } = contact;
            
            if (!name || !phone) {
                return res.status(400).json({ 
                    error: 'Missing required contact fields',
                    message: 'Contact name and phone are required'
                });
            }

            // Format phone number for vCard
            const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
            
            // Create vCard string
            let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
            vcard += `FN:${name}\n`;
            vcard += `TEL;TYPE=CELL:${formattedPhone}\n`;
            
            if (organization) {
                vcard += `ORG:${organization}\n`;
            }
            
            vcard += 'END:VCARD';

            // Create MessageMedia object for vCard
            const { MessageMedia } = require('whatsapp-web.js');
            contactToSend = new MessageMedia('text/vcard', Buffer.from(vcard).toString('base64'), `${name}.vcf`);
        }
        
        // Send the contact
        const sentMessage = await client.sendMessage(chatId, contactToSend);
        
        res.json({ 
            success: true,
            message: 'Contact sent successfully',
            phone_id: phoneId,
            to: chatId,
            messageId: sentMessage.id._serialized,
            timestamp: new Date().toISOString(),
            contactType: contactId ? 'existing' : 'new'
        });
    } catch (error) {
        console.error('❌ Error sending contact:', error);
        res.status(500).json({ 
            error: 'Failed to send contact',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Send reaction to a message
 * POST /api/v2/send-reaction
 */
router.post('/send-reaction', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { to, messageId, reaction } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!to || !messageId || !reaction) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: '"to", "messageId", and "reaction" are required'
            });
        }
        
        const message = await client.getMessageById(messageId);
        await message.react(reaction);
        
        res.json({ 
            success: true,
            message: 'Reaction sent successfully',
            phone_id: phoneId,
            to: to,
            messageId: messageId,
            reaction: reaction,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error sending reaction:', error);
        res.status(500).json({ 
            error: 'Failed to send reaction',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Create group
 * POST /api/v2/create-group
 */
router.post('/create-group', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { name, participants } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        // Validate input
        if (!name || !Array.isArray(participants)) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: '"name" and "participants" array are required'
            });
        }
        
        // Format participant numbers
        const formattedParticipants = participants.map(p => 
            p.includes('@c.us') ? p : `${p}@c.us`
        );
        
        const group = await client.createGroup(name, formattedParticipants);
        
        console.log(`✅ Group created by ${phoneId}: ${name}`);
        res.json({ 
            success: true,
            message: 'Group created successfully',
            phone_id: phoneId,
            group: {
                id: group.gid._serialized,
                name: name,
                participants: formattedParticipants.length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error creating group:', error);
        res.status(500).json({ 
            error: 'Failed to create group',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Get contacts
 * GET /api/v2/contacts
 */
router.get('/contacts', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        const contacts = await client.getContacts();
        const formattedContacts = contacts.map(contact => ({
            id: contact.id._serialized,
            name: contact.name || contact.pushname,
            pushname: contact.pushname,
            number: contact.number,
            isMyContact: contact.isMyContact,
            isUser: contact.isUser,
            isWAContact: contact.isWAContact,
            isGroup: contact.isGroup
        }));
        
        res.json({ 
            success: true,
            phone_id: phoneId,
            contacts: formattedContacts,
            total: formattedContacts.length
        });
    } catch (error) {
        console.error('❌ Error getting contacts:', error);
        res.status(500).json({ 
            error: 'Failed to get contacts',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Get chats
 * GET /api/v2/chats
 */
router.get('/chats', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        const chats = await client.getChats();
        const formattedChats = chats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            unreadCount: chat.unreadCount,
            timestamp: chat.timestamp,
            archived: chat.archived,
            pinned: chat.pinned,
            isMuted: chat.isMuted,
            isReadOnly: chat.isReadOnly
        }));
        
        res.json({ 
            success: true,
            phone_id: phoneId,
            chats: formattedChats,
            total: formattedChats.length
        });
    } catch (error) {
        console.error('❌ Error getting chats:', error);
        res.status(500).json({ 
            error: 'Failed to get chats',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Get groups
 * GET /api/v2/groups
 */
router.get('/groups', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        const chats = await client.getChats();
        const groups = chats
            .filter(chat => chat.isGroup)
            .map(group => ({
                id: group.id._serialized,
                name: group.name,
                participantCount: group.participants ? group.participants.length : 0,
                timestamp: group.timestamp,
                unreadCount: group.unreadCount || 0,
                archived: group.archived || false,
                pinned: group.pinned || false
            }));
        
        console.log(`✅ Found ${groups.length} groups for ${phoneId}`);
        res.json({ 
            success: true,
            phone_id: phoneId,
            groups: groups,
            total: groups.length
        });
    } catch (error) {
        console.error('❌ Error fetching groups:', error);
        res.status(500).json({ 
            error: 'Failed to fetch groups',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Mark chat as read
 * POST /api/v2/mark-read
 */
router.post('/mark-read', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { chatId } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!chatId) {
            return res.status(400).json({ 
                error: 'Missing required field',
                message: '"chatId" is required'
            });
        }
        
        const chat = await client.getChatById(chatId);
        await chat.sendSeen();
        
        res.json({ 
            success: true,
            message: 'Chat marked as read',
            phone_id: phoneId,
            chatId: chatId
        });
    } catch (error) {
        console.error('❌ Error marking chat as read:', error);
        res.status(500).json({ 
            error: 'Failed to mark chat as read',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Forward messages
 * POST /api/v2/forward-messages
 */
router.post('/forward-messages', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { to, messageIds } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!to || !Array.isArray(messageIds)) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: '"to" and "messageIds" array are required'
            });
        }
        
        const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
        const forwardedMessages = [];
        
        for (const msgId of messageIds) {
            const msg = await client.getMessageById(msgId);
            const forwardedMsg = await msg.forward(chatId);
            forwardedMessages.push(forwardedMsg.id._serialized);
        }
        
        res.json({ 
            success: true,
            message: 'Messages forwarded successfully',
            phone_id: phoneId,
            to: chatId,
            forwardedMessages: forwardedMessages,
            count: forwardedMessages.length
        });
    } catch (error) {
        console.error('❌ Error forwarding messages:', error);
        res.status(500).json({ 
            error: 'Failed to forward messages',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Get account info
 * GET /api/v2/account/info
 */
router.get('/account/info', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        const account = req.whatsappAccount;
        
        const info = client.info;
        
        res.json({ 
            success: true,
            phone_id: phoneId,
            account: {
                phone_number: account.phone_number,
                name: account.name,
                status: account.status,
                last_activity: account.last_activity,
                whatsapp_name: info.pushname,
                platform: info.platform,
                webhook_url: account.webhook_url
            }
        });
    } catch (error) {
        console.error('❌ Error getting account info:', error);
        res.status(500).json({ 
            error: 'Failed to get account info',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Get group details
 * GET /api/v2/groups/data/:groupId
 */
router.get('/groups/data/:groupId', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { groupId } = req.params;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        const chat = await client.getChatById(groupId);
        
        if (!chat || !chat.isGroup) {
            return res.status(404).json({ 
                error: 'Group not found',
                message: 'The specified group does not exist or is not accessible',
                phone_id: phoneId
            });
        }

        // Fetch detailed participant information with names and profile pictures
        const participants = await Promise.all(chat.participants.map(async (participant) => {
            try {
                // Get contact info to fetch the actual name
                const contact = await client.getContactById(participant.id._serialized);
                let profilePicUrl = null;
                
                try {
                    // Try to fetch profile picture URL
                    profilePicUrl = await client.getProfilePicUrl(participant.id._serialized);
                } catch (profileError) {
                    // Profile picture fetch failed, will use fallback
                    console.log(`Could not fetch profile picture for ${participant.id._serialized}:`, profileError.message);
                }

                return {
                    id: participant.id._serialized,
                    number: participant.id.user,
                    name: contact.name || contact.pushname || participant.id.user,
                    isAdmin: participant.isAdmin,
                    isSuperAdmin: participant.isSuperAdmin,
                    isMyContact: contact.isMyContact || false,
                    profilePicUrl: profilePicUrl
                };
            } catch (contactError) {
                console.log(`Could not fetch contact details for ${participant.id._serialized}:`, contactError.message);
                return {
                    id: participant.id._serialized,
                    number: participant.id.user,
                    name: participant.id.user, // Fallback to number
                    isAdmin: participant.isAdmin,
                    isSuperAdmin: participant.isSuperAdmin,
                    isMyContact: false,
                    profilePicUrl: null
                };
            }
        }));

        const groupData = {
            id: chat.id._serialized,
            name: chat.name,
            description: chat.description || '',
            participantCount: participants.length,
            participants: participants,
            createdAt: chat.createdAt ? Math.floor(chat.createdAt.getTime() / 1000) : null,
            owner: chat.owner ? chat.owner._serialized : null
        };
        
        console.log(`✅ Retrieved group data for ${phoneId}: ${chat.name}`);
        res.json({ 
            success: true,
            phone_id: phoneId,
            group: groupData
        });
    } catch (error) {
        console.error('❌ Error fetching group details:', error);
        res.status(500).json({ 
            error: 'Failed to fetch group details',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Add participant to group
 * POST /api/v2/groups/add-participant
 */
router.post('/groups/add-participant', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { groupId, participant } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!groupId || !participant) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'groupId and participant are required',
                phone_id: phoneId
            });
        }

        const chat = await client.getChatById(groupId);
        if (!chat || !chat.isGroup) {
            return res.status(404).json({ 
                error: 'Group not found',
                phone_id: phoneId
            });
        }

        const participantId = participant.includes('@') ? participant : `${participant}@c.us`;
        await chat.addParticipants([participantId]);
        
        console.log(`✅ Added participant ${participant} to group ${groupId} by ${phoneId}`);
        res.json({ 
            success: true,
            message: 'Participant added successfully',
            phone_id: phoneId,
            groupId,
            participant
        });
    } catch (error) {
        console.error('❌ Error adding participant:', error);
        res.status(500).json({ 
            error: 'Failed to add participant',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Remove participant from group
 * POST /api/v2/groups/remove-participant
 */
router.post('/groups/remove-participant', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { groupId, participant } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!groupId || !participant) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'groupId and participant are required',
                phone_id: phoneId
            });
        }

        const chat = await client.getChatById(groupId);
        if (!chat || !chat.isGroup) {
            return res.status(404).json({ 
                error: 'Group not found',
                phone_id: phoneId
            });
        }

        const participantId = participant.includes('@') ? participant : `${participant}@c.us`;
        await chat.removeParticipants([participantId]);
        
        console.log(`✅ Removed participant ${participant} from group ${groupId} by ${phoneId}`);
        res.json({ 
            success: true,
            message: 'Participant removed successfully',
            phone_id: phoneId,
            groupId,
            participant
        });
    } catch (error) {
        console.error('❌ Error removing participant:', error);
        res.status(500).json({ 
            error: 'Failed to remove participant',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Promote participant to admin
 * POST /api/v2/groups/set-admin
 */
router.post('/groups/set-admin', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { groupId, participant } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!groupId || !participant) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'groupId and participant are required',
                phone_id: phoneId
            });
        }

        const chat = await client.getChatById(groupId);
        if (!chat || !chat.isGroup) {
            return res.status(404).json({ 
                error: 'Group not found',
                phone_id: phoneId
            });
        }

        const participantId = participant.includes('@') ? participant : `${participant}@c.us`;
        await chat.promoteParticipants([participantId]);
        
        console.log(`✅ Promoted participant ${participant} to admin in group ${groupId} by ${phoneId}`);
        res.json({ 
            success: true,
            message: 'Participant promoted to admin successfully',
            phone_id: phoneId,
            groupId,
            participant
        });
    } catch (error) {
        console.error('❌ Error promoting participant:', error);
        res.status(500).json({ 
            error: 'Failed to promote participant',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Demote admin from group
 * POST /api/v2/groups/remove-admin
 */
router.post('/groups/remove-admin', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { groupId, participant } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!groupId || !participant) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'groupId and participant are required',
                phone_id: phoneId
            });
        }

        const chat = await client.getChatById(groupId);
        if (!chat || !chat.isGroup) {
            return res.status(404).json({ 
                error: 'Group not found',
                phone_id: phoneId
            });
        }

        const participantId = participant.includes('@') ? participant : `${participant}@c.us`;
        await chat.demoteParticipants([participantId]);
        
        console.log(`✅ Demoted admin ${participant} in group ${groupId} by ${phoneId}`);
        res.json({ 
            success: true,
            message: 'Admin demoted successfully',
            phone_id: phoneId,
            groupId,
            participant
        });
    } catch (error) {
        console.error('❌ Error demoting admin:', error);
        res.status(500).json({ 
            error: 'Failed to demote admin',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Update group name
 * POST /api/v2/groups/update-name
 */
router.post('/groups/update-name', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { groupId, name } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!groupId || !name) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'groupId and name are required',
                phone_id: phoneId
            });
        }

        const chat = await client.getChatById(groupId);
        if (!chat || !chat.isGroup) {
            return res.status(404).json({ 
                error: 'Group not found',
                phone_id: phoneId
            });
        }

        await chat.setSubject(name);
        
        console.log(`✅ Updated group name to "${name}" for group ${groupId} by ${phoneId}`);
        res.json({ 
            success: true,
            message: 'Group name updated successfully',
            phone_id: phoneId,
            groupId,
            name
        });
    } catch (error) {
        console.error('❌ Error updating group name:', error);
        res.status(500).json({ 
            error: 'Failed to update group name',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

/**
 * Leave group
 * POST /api/v2/groups/leave
 */
router.post('/groups/leave', requireSessionReady(phoneSessionManager), async (req, res) => {
    try {
        const { groupId } = req.body;
        const client = req.whatsappClient;
        const phoneId = req.phoneId;
        
        if (!groupId) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'groupId is required',
                phone_id: phoneId
            });
        }

        const chat = await client.getChatById(groupId);
        if (!chat || !chat.isGroup) {
            return res.status(404).json({ 
                error: 'Group not found',
                phone_id: phoneId
            });
        }

        await chat.leave();
        
        console.log(`✅ Left group ${groupId} by ${phoneId}`);
        res.json({ 
            success: true,
            message: 'Left group successfully',
            phone_id: phoneId,
            groupId
        });
    } catch (error) {
        console.error('❌ Error leaving group:', error);
        res.status(500).json({ 
            error: 'Failed to leave group',
            message: error.message,
            phone_id: req.phoneId
        });
    }
});

module.exports = router;