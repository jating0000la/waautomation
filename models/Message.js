const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

// Messages model
const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    messageId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    from: {
        type: DataTypes.STRING,
        allowNull: false
    },
    to: {
        type: DataTypes.STRING,
        allowNull: false
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    type: {
        type: DataTypes.ENUM('text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'vcard', 'multi_vcard', 'revoked', 'order', 'product', 'unknown', 'chat'),
        allowNull: false,
        defaultValue: 'text'
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false
    },
    isGroupMsg: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    author: {
        type: DataTypes.STRING,
        allowNull: true
    },
    quotedMsgId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mediaData: {
        type: DataTypes.JSON,
        allowNull: true
    },
    location: {
        type: DataTypes.JSON,
        allowNull: true
    },
    vCards: {
        type: DataTypes.JSON,
        allowNull: true
    },
    isForwarded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    forwardingScore: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    isStatus: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isStarred: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    fromMe: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['messageId'] },
        { fields: ['from'] },
        { fields: ['to'] },
        { fields: ['timestamp'] },
        { fields: ['isGroupMsg'] }
    ]
});

module.exports = Message;
