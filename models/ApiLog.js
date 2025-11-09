const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

// API Request Logs model
const ApiLog = sequelize.define('ApiLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    phone_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'WhatsApp account phone_id used for this request'
    },
    endpoint: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'API endpoint called (e.g., /api/v2/send-message)'
    },
    method: {
        type: DataTypes.ENUM('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        allowNull: false,
        defaultValue: 'POST'
    },
    request_body: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Request payload'
    },
    response_body: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'API response'
    },
    status_code: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'HTTP status code'
    },
    success: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error details if request failed'
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'Client IP address'
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Client user agent'
    },
    response_time: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Response time in milliseconds'
    },
    api_key_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'API key used for authentication (if applicable)'
    },
    message_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'WhatsApp message ID for send operations'
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['phone_id'] },
        { fields: ['endpoint'] },
        { fields: ['method'] },
        { fields: ['success'] },
        { fields: ['status_code'] },
        { fields: ['createdAt'] },
        { fields: ['ip_address'] }
    ]
});

module.exports = ApiLog;
