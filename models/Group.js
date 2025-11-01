const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

// Groups model
const Group = sequelize.define('Group', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    groupId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    owner: {
        type: DataTypes.STRING,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    participants: {
        type: DataTypes.JSON,
        allowNull: true
    },
    admins: {
        type: DataTypes.JSON,
        allowNull: true
    },
    isReadOnly: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isAnnouncement: {
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
    inviteCode: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['groupId'] },
        { fields: ['owner'] }
    ]
});

module.exports = Group;
