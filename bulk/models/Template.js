const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database');

const Template = sequelize.define('Template', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    category: {
        type: DataTypes.ENUM('marketing', 'promotional', 'transactional', 'reminder', 'notification'),
        allowNull: false,
        defaultValue: 'promotional'
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    mediaType: {
        type: DataTypes.ENUM('none', 'image', 'document', 'video', 'audio'),
        defaultValue: 'none'
    },
    mediaUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    variables: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    language: {
        type: DataTypes.STRING,
        defaultValue: 'en'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'archived'),
        defaultValue: 'active'
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['category'] },
        { fields: ['status'] }
    ]
});

module.exports = Template;
