const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database');

const ComplianceRule = sequelize.define('ComplianceRule', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    config: { type: DataTypes.JSON, allowNull: true },
    severity: { type: DataTypes.ENUM('low','medium','high','critical'), defaultValue: 'low' },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    violations: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

module.exports = ComplianceRule;
