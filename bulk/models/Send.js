const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database');

const Send = sequelize.define('Send', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    campaignId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Campaigns',
            key: 'id'
        }
    },
    audienceId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Audiences',
            key: 'id'
        }
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    renderedMessage: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    attachments: {
        type: DataTypes.JSON,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'opted_out', 'skipped'),
        defaultValue: 'queued'
    },
    errorCode: {
        type: DataTypes.STRING,
        allowNull: true
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    sentAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    readAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    whatsappMessageId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    retryCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    scheduledFor: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['campaignId'] },
        { fields: ['phone'] },
        { fields: ['status'] },
        { fields: ['sentAt'] },
        { fields: ['scheduledFor'] }
    ]
});

module.exports = Send;
