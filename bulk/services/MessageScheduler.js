const { Send, Campaign, SystemSettings } = require('../models');
const TemplateRenderer = require('./TemplateRenderer');

class MessageScheduler {
    constructor(campaign, audienceMembers) {
        this.campaign = campaign;
        this.audienceMembers = audienceMembers;
        this.currentIndex = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.timer = null;
        this.stats = {
            sent: 0,
            failed: 0,
            remaining: audienceMembers.length,
            startTime: null,
            estimatedCompletion: null
        };
    }

    async start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.stats.startTime = new Date();
        
        console.log(`Starting message scheduler for campaign ${this.campaign.id}`);
        await this.scheduleNextMessage();
    }

    async pause() {
        this.isPaused = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        console.log(`Message scheduler paused for campaign ${this.campaign.id}`);
    }

    async stop() {
        this.isRunning = false;
        this.isPaused = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        console.log(`Message scheduler stopped for campaign ${this.campaign.id}`);
    }

    async scheduleNextMessage() {
        if (!this.isRunning || this.isPaused) return;
        
        // Check if we've sent to all audience members
        if (this.currentIndex >= this.audienceMembers.length) {
            await this.completeCampaign();
            return;
        }

        // Get throttling settings
        const settings = await this.getThrottlingSettings();
        
        try {
            // Send message to current audience member
            const audienceMember = this.audienceMembers[this.currentIndex];
            await this.sendMessage(audienceMember);
            
            this.currentIndex++;
            this.stats.remaining = this.audienceMembers.length - this.currentIndex;
            
            // Update estimated completion time
            this.updateEstimatedCompletion(settings);
            
            // Schedule next message based on throttling settings
            const delay = this.calculateDelay(settings);
            this.timer = setTimeout(() => {
                this.scheduleNextMessage();
            }, delay);
            
        } catch (error) {
            console.error(`Error in message scheduler for campaign ${this.campaign.id}:`, error);
            this.stats.failed++;
            this.currentIndex++;
            
            // Continue with next message after a short delay
            this.timer = setTimeout(() => {
                this.scheduleNextMessage();
            }, 5000);
        }
    }

    async sendMessage(audienceMember) {
        try {
            // Skip soft-deleted contacts if such flag exists
            if (audienceMember.isDeleted) {
                console.log(`Skipping deleted audience member ${audienceMember.phone}`);
                return;
            }

            if (!this.campaign.template) {
                throw new Error('Campaign template not loaded in scheduler context');
            }

            // Render the template with audience member data
            const renderedContent = await TemplateRenderer.render(
                this.campaign.template.body,
                {
                    name: audienceMember.name || 'there',
                    phone: audienceMember.phone,
                    ...audienceMember.customFields
                }
            );

            // Create send record early
            const sendRecord = await Send.create({
                campaignId: this.campaign.id,
                audienceId: audienceMember.id,
                phone: audienceMember.phone,
                renderedMessage: renderedContent,
                status: 'queued',
                scheduledFor: new Date()
            });

            // WhatsApp readiness guard
            if (!global.whatsappReady || !global.whatsappClient) {
                await sendRecord.update({
                    status: 'failed',
                    errorMessage: 'WhatsApp client not ready',
                    sentAt: null
                });
                this.stats.failed++;
                console.warn(`Client not ready, failing send for ${audienceMember.phone}`);
                await this.updateCampaignStats();
                return;
            }

            const success = await this.sendWhatsAppMessage(
                audienceMember.phone,
                renderedContent,
                this.campaign.template.mediaUrl
            );

            // Update send record (include whatsappMessageId if available)
            await sendRecord.update({
                status: success ? 'sent' : 'failed',
                sentAt: success ? new Date() : null,
                errorMessage: success ? null : (sendRecord.errorMessage || 'Failed to send WhatsApp message'),
                whatsappMessageId: success && this.lastWhatsAppMessageId ? this.lastWhatsAppMessageId : sendRecord.whatsappMessageId
            });

            if (success) {
                this.stats.sent++;
                console.log(`Message sent to ${audienceMember.phone} for campaign ${this.campaign.id}`);
            } else {
                this.stats.failed++;
                console.log(`Failed to send message to ${audienceMember.phone} for campaign ${this.campaign.id}`);
            }

            await this.updateCampaignStats();

        } catch (error) {
            console.error(`Error sending message to ${audienceMember.phone}:`, error.message);
            this.stats.failed++;
            // Attempt to persist failure context
            try {
                await Send.create({
                    campaignId: this.campaign.id,
                    audienceId: audienceMember.id,
                    phone: audienceMember.phone,
                    renderedMessage: error.renderedContent || '',
                    status: 'failed',
                    errorMessage: error.message,
                    scheduledFor: new Date()
                });
            } catch (persistErr) {
                console.error('Secondary error persisting failed send:', persistErr.message);
            }
        }
    }

    async sendWhatsAppMessage(phone, content, mediaUrl = null) {
        try {
            if (!global.whatsappClient || !global.whatsappReady) {
                console.warn('WhatsApp client not initialized or not ready yet');
                return false;
            }

            const client = global.whatsappClient;
            const whatsappPhone = phone.replace(/[^0-9]/g, '') + '@c.us';

            let messageOptions = {};
            let sentMsg;

            if (mediaUrl) {
                try {
                    const { MessageMedia } = require('whatsapp-web.js');
                    const path = require('path');
                    const fs = require('fs');
                    let media;
                    if (/^https?:\/\//i.test(mediaUrl)) {
                        // Remote media fetch
                        const axios = require('axios');
                        const resp = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
                        const mimeType = resp.headers['content-type'] || 'application/octet-stream';
                        const base64 = Buffer.from(resp.data).toString('base64');
                        const fileName = mediaUrl.split('/').pop() || 'file';
                        media = new MessageMedia(mimeType, base64, fileName);
                    } else {
                        // Local file
                        const resolved = path.resolve(mediaUrl);
                        if (fs.existsSync(resolved)) {
                            const fileBuffer = fs.readFileSync(resolved);
                            const mime = require('mime-types');
                            const mimeType = mime.lookup(resolved) || 'application/octet-stream';
                            const base64 = fileBuffer.toString('base64');
                            media = new MessageMedia(mimeType, base64, path.basename(resolved));
                        } else {
                            console.warn('Media file not found at', resolved);
                        }
                    }
                    if (media) {
                        sentMsg = await client.sendMessage(whatsappPhone, media, { caption: content, ...messageOptions });
                    } else {
                        sentMsg = await client.sendMessage(whatsappPhone, content, messageOptions);
                    }
                } catch (mediaErr) {
                    console.warn('Media send failed, falling back to text:', mediaErr.message);
                    sentMsg = await client.sendMessage(whatsappPhone, content, messageOptions);
                }
            } else {
                sentMsg = await client.sendMessage(whatsappPhone, content, messageOptions);
            }

            // Attach whatsapp message id to latest Send record if available
            if (sentMsg && sentMsg.id && sentMsg.id._serialized) {
                // We can't update here because we don't have the send record reference; caller updates status.
                this.lastWhatsAppMessageId = sentMsg.id._serialized;
            }

            return true;
        } catch (error) {
            console.error('WhatsApp send error:', error);
            return false;
        }
    }

    async getThrottlingSettings() {
        const settings = await SystemSettings.findOne();
        return {
            messagesPerMinute: settings?.messagesPerMinute || 10,
            messagesPerHour: settings?.messagesPerHour || 300,
            messagesPerDay: settings?.messagesPerDay || 1000,
            warmupMode: settings?.warmupMode || false,
            warmupLimit: settings?.warmupLimit || 50
        };
    }

    calculateDelay(settings) {
        // Base delay from messages per minute setting
        const baseDelay = (60 * 1000) / settings.messagesPerMinute;
        
        // Add randomization to avoid pattern detection (±25%)
        const randomFactor = 0.75 + (Math.random() * 0.5);
        const delay = baseDelay * randomFactor;
        
        // Ensure minimum delay of 2 seconds
        return Math.max(delay, 2000);
    }

    updateEstimatedCompletion(settings) {
        if (this.stats.remaining > 0) {
            const avgDelay = (60 * 1000) / settings.messagesPerMinute;
            const estimatedMs = this.stats.remaining * avgDelay;
            this.stats.estimatedCompletion = new Date(Date.now() + estimatedMs);
        }
    }

    async updateCampaignStats() {
        await this.campaign.update({
            messagesSent: this.stats.sent,
            messagesFailed: this.stats.failed,
            lastActivity: new Date()
        });
    }

    async completeCampaign() {
        this.isRunning = false;
        
        await this.campaign.update({
            status: 'completed',
            completedAt: new Date(),
            messagesSent: this.stats.sent,
            messagesFailed: this.stats.failed
        });

        console.log(`Campaign ${this.campaign.id} completed. Sent: ${this.stats.sent}, Failed: ${this.stats.failed}`);
        
        // Notify scheduler to clean up memory
        if (global.campaignScheduler) {
            const scheduler = global.campaignScheduler.activeSchedules.get(this.campaign.id);
            if (scheduler) {
                global.campaignScheduler.activeSchedules.delete(this.campaign.id);
            }
        }
    }

    getStatus() {
        return {
            campaignId: this.campaign.id,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentIndex: this.currentIndex,
            totalMessages: this.audienceMembers.length,
            stats: { ...this.stats },
            progress: this.audienceMembers.length > 0 ? 
                ((this.currentIndex / this.audienceMembers.length) * 100).toFixed(1) : 0
        };
    }
}

module.exports = MessageScheduler;
