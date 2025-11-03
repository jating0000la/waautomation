const { Sequelize } = require('sequelize');
require('dotenv').config();

// Get pool configuration from environment or use defaults
const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10');
const DB_POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2');
const DB_POOL_ACQUIRE = parseInt(process.env.DB_POOL_ACQUIRE || '30000');
const DB_POOL_IDLE = parseInt(process.env.DB_POOL_IDLE || '30000');

// Create Sequelize instance
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
    pool: {
        max: DB_POOL_MAX,        // Maximum connections
        min: DB_POOL_MIN,        // Minimum connections to keep open
        acquire: DB_POOL_ACQUIRE, // Maximum time to get connection before timeout
        idle: DB_POOL_IDLE,      // Maximum time connection can be idle before release
        evict: 60000             // Run eviction every 60 seconds
    },
    retry: {
        max: 3,                  // Maximum retry attempts
        timeout: 3000            // Timeout between retries
    }
});

// Test database connection with retry logic
const testConnection = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            await sequelize.authenticate();
            console.log('✅ Database connection has been established successfully.');
            return true;
        } catch (error) {
            console.error(`❌ Database connection attempt ${i + 1} failed:`, error.message);
            
            if (i === retries - 1) {
                console.error('❌ Unable to connect to the database after multiple attempts');
                throw error;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

module.exports = { sequelize, testConnection };
