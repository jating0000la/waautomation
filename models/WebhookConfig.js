const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const WebhookConfig = sequelize.define('WebhookConfig', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        apiKeyId: {
            type: DataTypes.UUID,
            allowNull: false,
            comment: 'API key that owns this webhook'
        },
        url: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isUrl: true
            },
            comment: 'Webhook endpoint URL'
        },
        events: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: ['message', 'message_ack', 'message_reaction'],
            comment: 'Events to subscribe to'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        secret: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Secret for webhook signature verification'
        },
        headers: {
            type: DataTypes.JSONB,
            defaultValue: {},
            comment: 'Custom headers to send with webhook requests'
        },
        retryConfig: {
            type: DataTypes.JSONB,
            defaultValue: {
                maxRetries: 3,
                retryDelay: 1000
            }
        },
        lastTriggered: {
            type: DataTypes.DATE,
            allowNull: true
        },
        totalCalls: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        successfulCalls: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        failedCalls: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        tableName: 'webhook_configs',
        timestamps: true,
        indexes: [
            {
                fields: ['apiKeyId']
            },
            {
                fields: ['isActive']
            }
        ]
    });

    return WebhookConfig;
};
