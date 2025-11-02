const axios = require('axios');
const crypto = require('crypto');

/**
 * Webhook Service for sending real-time notifications to external applications
 */

class WebhookService {
    constructor() {
        this.webhooks = new Map(); // In-memory cache of active webhooks
        this.initialized = false;
    }

    /**
     * Initialize webhook service and load active webhooks
     */
    async initialize() {
        if (this.initialized) return;

        try {
            const { sequelize } = require('../database');
            const WebhookConfig = require('../models/WebhookConfig')(sequelize);

            // Load all active webhooks into memory
            const activeWebhooks = await WebhookConfig.findAll({
                where: { isActive: true }
            });

            for (const webhook of activeWebhooks) {
                this.webhooks.set(webhook.id, webhook);
            }

            console.log(`✅ Webhook service initialized with ${this.webhooks.size} active webhooks`);
            this.initialized = true;
        } catch (error) {
            console.error('❌ Error initializing webhook service:', error);
        }
    }

    /**
     * Generate HMAC signature for webhook payload
     */
    generateSignature(payload, secret) {
        if (!secret) return null;
        return crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }

    /**
     * Send webhook notification
     */
    async sendWebhook(webhookConfig, event, data) {
        if (!webhookConfig.isActive) return;

        const payload = {
            event: event,
            timestamp: new Date().toISOString(),
            data: data
        };

        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'WhatsApp-Webhook/1.0',
            ...webhookConfig.headers
        };

        // Add signature if secret is configured
        if (webhookConfig.secret) {
            headers['X-Webhook-Signature'] = this.generateSignature(payload, webhookConfig.secret);
        }

        const maxRetries = webhookConfig.retryConfig?.maxRetries || 3;
        const retryDelay = webhookConfig.retryConfig?.retryDelay || 1000;

        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.post(webhookConfig.url, payload, {
                    headers: headers,
                    timeout: 10000 // 10 second timeout
                });

                // Success
                await this.recordSuccess(webhookConfig.id);
                
                console.log(`✅ Webhook sent successfully to ${webhookConfig.url} (event: ${event})`);
                return true;

            } catch (error) {
                lastError = error;
                console.error(`❌ Webhook attempt ${attempt + 1} failed:`, error.message);

                // Wait before retry
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
                }
            }
        }

        // All retries failed
        await this.recordFailure(webhookConfig.id, lastError);
        console.error(`❌ Webhook failed after ${maxRetries + 1} attempts to ${webhookConfig.url}`);
        return false;
    }

    /**
     * Trigger webhooks for a specific event
     */
    async trigger(event, data) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Find all webhooks subscribed to this event
        const subscribedWebhooks = Array.from(this.webhooks.values())
            .filter(webhook => 
                webhook.isActive && 
                webhook.events.includes(event)
            );

        if (subscribedWebhooks.length === 0) {
            return;
        }

        console.log(`📢 Triggering ${subscribedWebhooks.length} webhooks for event: ${event}`);

        // Send webhooks in parallel (but don't wait for completion)
        const promises = subscribedWebhooks.map(webhook => 
            this.sendWebhook(webhook, event, data).catch(err => {
                console.error('Webhook error:', err);
            })
        );

        // Fire and forget (don't block)
        Promise.allSettled(promises);
    }

    /**
     * Record successful webhook call
     */
    async recordSuccess(webhookId) {
        try {
            const { sequelize } = require('../database');
            const WebhookConfig = require('../models/WebhookConfig')(sequelize);

            await WebhookConfig.increment(
                ['totalCalls', 'successfulCalls'],
                { where: { id: webhookId } }
            );

            await WebhookConfig.update(
                { lastTriggered: new Date() },
                { where: { id: webhookId } }
            );
        } catch (error) {
            console.error('Error recording webhook success:', error);
        }
    }

    /**
     * Record failed webhook call
     */
    async recordFailure(webhookId, error) {
        try {
            const { sequelize } = require('../database');
            const WebhookConfig = require('../models/WebhookConfig')(sequelize);

            await WebhookConfig.increment(
                ['totalCalls', 'failedCalls'],
                { where: { id: webhookId } }
            );

            await WebhookConfig.update(
                { lastTriggered: new Date() },
                { where: { id: webhookId } }
            );
        } catch (error) {
            console.error('Error recording webhook failure:', error);
        }
    }

    /**
     * Reload webhooks from database
     */
    async reload() {
        this.initialized = false;
        this.webhooks.clear();
        await this.initialize();
    }

    /**
     * Register a new webhook
     */
    async register(apiKeyId, url, events, options = {}) {
        try {
            const { sequelize } = require('../database');
            const WebhookConfig = require('../models/WebhookConfig')(sequelize);

            const webhook = await WebhookConfig.create({
                apiKeyId: apiKeyId,
                url: url,
                events: events,
                secret: options.secret || null,
                headers: options.headers || {},
                retryConfig: options.retryConfig || {
                    maxRetries: 3,
                    retryDelay: 1000
                },
                isActive: true
            });

            // Add to memory cache
            this.webhooks.set(webhook.id, webhook);

            console.log(`✅ Webhook registered: ${url}`);
            return webhook;
        } catch (error) {
            console.error('❌ Error registering webhook:', error);
            throw error;
        }
    }

    /**
     * Unregister a webhook
     */
    async unregister(webhookId) {
        try {
            const { sequelize } = require('../database');
            const WebhookConfig = require('../models/WebhookConfig')(sequelize);

            await WebhookConfig.destroy({ where: { id: webhookId } });
            this.webhooks.delete(webhookId);

            console.log(`✅ Webhook unregistered: ${webhookId}`);
        } catch (error) {
            console.error('❌ Error unregistering webhook:', error);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new WebhookService();
