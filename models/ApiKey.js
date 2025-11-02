const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
    const ApiKey = sequelize.define('ApiKey', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Friendly name for the API key'
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: 'The actual API key'
        },
        keyHash: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Hashed version of the API key for secure storage'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        permissions: {
            type: DataTypes.JSONB,
            defaultValue: {
                sendMessage: true,
                sendMedia: true,
                sendLocation: true,
                sendContact: true,
                sendReaction: true,
                createGroup: true,
                manageGroups: true,
                readMessages: true,
                webhook: true
            },
            comment: 'JSON object defining what this key can do'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        lastUsed: {
            type: DataTypes.DATE,
            allowNull: true
        },
        usageCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        rateLimit: {
            type: DataTypes.INTEGER,
            defaultValue: 100,
            comment: 'Max requests per minute'
        },
        ipWhitelist: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: [],
            comment: 'List of allowed IP addresses (empty = all allowed)'
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Optional expiration date'
        },
        createdBy: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'api_keys',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['key']
            },
            {
                fields: ['isActive']
            }
        ]
    });

    // Class method to generate a new API key
    ApiKey.generateKey = function(prefix = 'wa') {
        const randomBytes = crypto.randomBytes(32).toString('hex');
        return `${prefix}_${randomBytes}`;
    };

    // Class method to hash API key
    ApiKey.hashKey = function(key) {
        return crypto.createHash('sha256').update(key).digest('hex');
    };

    // Instance method to check if key has specific permission
    ApiKey.prototype.hasPermission = function(permission) {
        return this.permissions && this.permissions[permission] === true;
    };

    // Instance method to check if key is expired
    ApiKey.prototype.isExpired = function() {
        if (!this.expiresAt) return false;
        return new Date() > new Date(this.expiresAt);
    };

    // Instance method to check if IP is allowed
    ApiKey.prototype.isIpAllowed = function(ip) {
        if (!this.ipWhitelist || this.ipWhitelist.length === 0) return true;
        return this.ipWhitelist.includes(ip);
    };

    // Hook to update last used and usage count
    ApiKey.prototype.recordUsage = async function() {
        this.lastUsed = new Date();
        this.usageCount += 1;
        await this.save();
    };

    return ApiKey;
};
