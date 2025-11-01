const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

// Contacts model
const Contact = sequelize.define('Contact', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    contactId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pushname: {
        type: DataTypes.STRING,
        allowNull: true
    },
    shortName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isUser: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isGroup: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isWAContact: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    profilePicThumbObj: {
        type: DataTypes.JSON,
        allowNull: true
    },
    statusMute: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    labels: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['contactId'] },
        { fields: ['number'] },
        { fields: ['isGroup'] }
    ]
});

module.exports = Contact;
