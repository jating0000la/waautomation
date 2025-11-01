const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database');

const Audience = sequelize.define('Audience', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    customFields: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    tags: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    consentStatus: {
        type: DataTypes.ENUM('opted_in', 'unknown', 'opted_out'),
        defaultValue: 'unknown'
    },
    lastMessagedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    messageFrequencyCounter: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    source: {
        type: DataTypes.STRING,
        allowNull: true
    },
    importedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['phone'] },
        { fields: ['consentStatus'] },
        { fields: ['lastMessagedAt'] },
        { fields: ['isDeleted'] }
    ]
});

module.exports = Audience;
