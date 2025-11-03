const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const crypto = require('crypto');

const WhatsAppAccount = sequelize.define('WhatsAppAccount', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    phone_id: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        comment: 'Unique identifier for the phone/account'
    },
    phone_number: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'WhatsApp phone number after authentication'
    },
    token: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'API token for this account'
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Display name for this account'
    },
    status: {
        type: DataTypes.ENUM('pending', 'connected', 'disconnected', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
        comment: 'Connection status of the WhatsApp account'
    },
    qr_code: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Base64 encoded QR code for authentication'
    },
    session_data: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Session information for maintaining connection'
    },
    last_activity: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last activity timestamp'
    },
    webhook_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Webhook URL for this specific account'
    },
    webhook_events: {
        type: DataTypes.JSON,
        defaultValue: ['message', 'status'],
        comment: 'Array of webhook events to subscribe to'
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            auto_reply: false,
            message_logging: true,
            media_download: true
        },
        comment: 'Account-specific settings'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'whatsapp_accounts',
    timestamps: false,
    indexes: [
        {
            fields: ['phone_id']
        },
        {
            fields: ['token']
        },
        {
            fields: ['status']
        }
    ]
});

// Static method to generate a new token
WhatsAppAccount.generateToken = function() {
    return crypto.randomBytes(32).toString('hex');
};

// Instance method to update last activity
WhatsAppAccount.prototype.updateActivity = function() {
    this.last_activity = new Date();
    return this.save();
};

// Instance method to update status
WhatsAppAccount.prototype.updateStatus = function(status, sessionData = null) {
    this.status = status;
    if (sessionData) {
        this.session_data = sessionData;
    }
    this.last_activity = new Date();
    return this.save();
};

// Instance method to clear QR code
WhatsAppAccount.prototype.clearQRCode = function() {
    this.qr_code = null;
    return this.save();
};

module.exports = WhatsAppAccount;