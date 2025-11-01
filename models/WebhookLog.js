const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

// WebhookLogs model for storing webhook events
const WebhookLog = sequelize.define('WebhookLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    eventType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    data: {
        type: DataTypes.JSON,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    processed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['eventType'] },
        { fields: ['timestamp'] },
        { fields: ['processed'] }
    ]
});

module.exports = WebhookLog;
