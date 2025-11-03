const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

// Chats model
const Chat = sequelize.define('Chat', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    chatId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isGroup: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isReadOnly: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    unreadCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: true
    },
    archived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isMuted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    muteExpiration: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastMessage: {
        type: DataTypes.JSON,
        allowNull: true
    },
    phone_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'WhatsApp account phone_id this chat belongs to'
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['chatId'] },
        { fields: ['isGroup'] },
        { fields: ['timestamp'] },
        { fields: ['phone_id'] }
    ]
});

module.exports = Chat;
