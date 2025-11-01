const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database');

const Campaign = sequelize.define('Campaign', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    templateId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Templates',
            key: 'id'
        }
    },
    segmentFilter: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    scheduleWindow: {
        type: DataTypes.JSON,
        defaultValue: { start: '09:00', end: '18:00' }
    },
    sendTimezone: {
        type: DataTypes.STRING,
        defaultValue: 'Asia/Kolkata'
    },
    rateLimit: {
        type: DataTypes.JSON,
        defaultValue: {
            msgsPerMinute: 6,
            batchSize: 25,
            batchRestMs: 90000,
            jitterMsMin: 800,
            jitterMsMax: 3000,
            dailyCap: 300
        }
    },
    status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'failed'),
        defaultValue: 'draft'
    },
    createdBy: {
        type: DataTypes.STRING,
        allowNull: true
    },
    scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    warmupMode: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    totalRecipients: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    sentCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    deliveredCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    failedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    optedOutCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['status'] },
        { fields: ['scheduledAt'] },
        { fields: ['createdBy'] }
    ]
});

module.exports = Campaign;
