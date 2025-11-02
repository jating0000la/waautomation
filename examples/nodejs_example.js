/**
 * WhatsApp API Node.js Example
 * A simple client for interacting with the WhatsApp External API
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class WhatsAppClient {
    /**
     * Initialize WhatsApp API client
     * @param {string} baseUrl - Base URL of the API
     * @param {string} apiKey - Your API key
     */
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiKey = apiKey;
        this.client = axios.create({
            baseURL: `${this.baseUrl}/api/external`,
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Check WhatsApp connection status
     */
    async getStatus() {
        const response = await this.client.get('/status');
        return response.data;
    }

    /**
     * Send text message
     * @param {string} to - Recipient phone number
     * @param {string} message - Message text
     * @param {string[]} mentions - Optional array of phone numbers to mention
     */
    async sendMessage(to, message, mentions = null) {
        const data = { to, message };
        if (mentions) data.mentions = mentions;
        
        const response = await this.client.post('/send-message', data);
        return response.data;
    }

    /**
     * Send media file
     * @param {string} to - Recipient phone number
     * @param {string} filePath - Path to media file
     * @param {string} caption - Optional caption
     */
    async sendMedia(to, filePath, caption = null) {
        const form = new FormData();
        form.append('to', to);
        form.append('file', fs.createReadStream(filePath));
        if (caption) form.append('caption', caption);

        const response = await axios.post(
            `${this.baseUrl}/api/external/send-media`,
            form,
            {
                headers: {
                    'X-API-Key': this.apiKey,
                    ...form.getHeaders()
                }
            }
        );
        return response.data;
    }

    /**
     * Send file from URL
     * @param {string} to - Recipient phone number
     * @param {string} url - File URL
     * @param {string} caption - Optional caption
     * @param {string} filename - Optional custom filename
     */
    async sendFileUrl(to, url, caption = null, filename = null) {
        const data = { to, url };
        if (caption) data.caption = caption;
        if (filename) data.filename = filename;
        
        const response = await this.client.post('/send-file-url', data);
        return response.data;
    }

    /**
     * Send location
     * @param {string} to - Recipient phone number
     * @param {number} latitude - Location latitude
     * @param {number} longitude - Location longitude
     * @param {string} description - Optional description
     */
    async sendLocation(to, latitude, longitude, description = null) {
        const data = { to, latitude, longitude };
        if (description) data.description = description;
        
        const response = await this.client.post('/send-location', data);
        return response.data;
    }

    /**
     * Send contact vCard
     * @param {string} to - Recipient phone number
     * @param {string} contactId - Contact's phone number
     */
    async sendContact(to, contactId) {
        const response = await this.client.post('/send-contact', { to, contactId });
        return response.data;
    }

    /**
     * Send reaction to message
     * @param {string} messageId - Message ID to react to
     * @param {string} reaction - Emoji reaction
     */
    async sendReaction(messageId, reaction) {
        const response = await this.client.post('/send-reaction', { messageId, reaction });
        return response.data;
    }

    /**
     * Create WhatsApp group
     * @param {string} name - Group name
     * @param {string[]} participants - Array of phone numbers
     */
    async createGroup(name, participants) {
        const response = await this.client.post('/create-group', { name, participants });
        return response.data;
    }

    /**
     * Get all groups
     */
    async getGroups() {
        const response = await this.client.get('/groups');
        return response.data;
    }

    /**
     * Get group details
     * @param {string} groupId - Group ID
     */
    async getGroup(groupId) {
        const response = await this.client.get(`/groups/${groupId}`);
        return response.data;
    }

    /**
     * Add participant to group
     * @param {string} groupId - Group ID
     * @param {string} participant - Phone number to add
     */
    async addParticipant(groupId, participant) {
        const response = await this.client.post(`/groups/${groupId}/participants`, { participant });
        return response.data;
    }

    /**
     * Remove participant from group
     * @param {string} groupId - Group ID
     * @param {string} participantId - Participant ID to remove
     */
    async removeParticipant(groupId, participantId) {
        const response = await this.client.delete(`/groups/${groupId}/participants/${participantId}`);
        return response.data;
    }

    /**
     * Get all contacts
     */
    async getContacts() {
        const response = await this.client.get('/contacts');
        return response.data;
    }

    /**
     * Get all chats
     */
    async getChats() {
        const response = await this.client.get('/chats');
        return response.data;
    }
}

// Example usage
async function main() {
    // Initialize client
    const client = new WhatsAppClient(
        'http://localhost:3000',
        'YOUR_API_KEY_HERE'
    );

    try {
        // Check status
        console.log('Checking WhatsApp status...');
        const status = await client.getStatus();
        console.log('Status:', status);

        if (!status.connected) {
            console.log('⚠️ WhatsApp is not connected!');
            return;
        }

        // Send a text message
        console.log('\nSending text message...');
        const messageResult = await client.sendMessage(
            '1234567890',
            'Hello from Node.js! 🚀'
        );
        console.log('Message sent:', messageResult);

        // Send location
        console.log('\nSending location...');
        const locationResult = await client.sendLocation(
            '1234567890',
            40.7128,
            -74.0060,
            'New York City'
        );
        console.log('Location sent:', locationResult);

        // Get all groups
        console.log('\nFetching groups...');
        const groups = await client.getGroups();
        console.log('Groups:', JSON.stringify(groups, null, 2));

        console.log('\n✅ All operations completed successfully!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// Run example
if (require.main === module) {
    main();
}

module.exports = WhatsAppClient;
