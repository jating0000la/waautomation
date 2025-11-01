const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database');

const ComplianceAudit = sequelize.define('ComplianceAudit', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    action: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    severity: { type: DataTypes.ENUM('info','low','medium','high','critical'), defaultValue: 'info' }
}, { timestamps: true });

module.exports = ComplianceAudit;
