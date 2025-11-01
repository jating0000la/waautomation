const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database');

const SystemSettings = sequelize.define('SystemSettings', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    value: {
        type: DataTypes.JSON,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['key'] }
    ]
});

module.exports = SystemSettings;
