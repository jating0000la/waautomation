const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database');

const DND = sequelize.define('DND', {
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
    reason: {
        type: DataTypes.STRING,
        allowNull: true
    },
    source: {
        type: DataTypes.ENUM('STOP_keyword', 'manual', 'admin', 'auto'),
        defaultValue: 'manual'
    },
    addedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    addedBy: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['phone'] },
        { fields: ['source'] },
        { fields: ['addedAt'] }
    ]
});

module.exports = DND;
