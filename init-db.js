const { sequelize } = require('./database');

// Import all models
const Message = require('./models/Message');
const Contact = require('./models/Contact');  
const Chat = require('./models/Chat');
const Group = require('./models/Group');
const WebhookLog = require('./models/WebhookLog');

// Import bulk messaging models
const Template = require('./bulk/models/Template');
const Audience = require('./bulk/models/Audience');
const Campaign = require('./bulk/models/Campaign');
const Send = require('./bulk/models/Send');
const DND = require('./bulk/models/DND');
const SystemSettings = require('./bulk/models/SystemSettings');

async function initializeDatabase() {
    try {
        console.log('🚀 Starting database initialization...');
        
        // Test connection
        await sequelize.authenticate();
        console.log('✅ Database connection successful');
        
        // Skip main models sync as they already exist
        console.log('📊 Skipping main tables (already exist)...');
        
        // Sync bulk messaging models (in order of dependencies)
        console.log('📊 Creating bulk messaging tables...');
        await Template.sync({ force: false });
        await Audience.sync({ force: false });
        await Campaign.sync({ force: false });
        await Send.sync({ force: false });
        await DND.sync({ force: false });
        await SystemSettings.sync({ force: false });
        console.log('✅ Bulk messaging tables created successfully');
        
        // Create default system settings if they don't exist
        console.log('⚙️ Setting up default system settings...');
        const [settings, created] = await SystemSettings.findOrCreate({
            where: { key: 'bulk_messaging_config' },
            defaults: {
                key: 'bulk_messaging_config',
                value: JSON.stringify({
                    throttling: {
                        messagesPerMinute: 10,
                        messagesPerHour: 300,
                        messagesPerDay: 1000,
                        messageDelay: 6,
                        delayVariance: 20
                    },
                    banPrevention: {
                        enabled: true,
                        warmupMode: true,
                        warmupIncreaseRate: 20,
                        warmupDuration: 7,
                        warmupStartVolume: 10
                    },
                    workingHours: {
                        enabled: true,
                        timezoneDetection: false,
                        startTime: '09:00',
                        endTime: '18:00',
                        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                    },
                    retry: {
                        maxAttempts: 3,
                        delayMinutes: 15,
                        backoffMultiplier: 2
                    },
                    webhook: {
                        url: '',
                        secret: '',
                        events: ['messageSent', 'messageFailed', 'campaignStart', 'campaignComplete']
                    },
                    debug: {
                        logLevel: 'info',
                        logRetention: 30,
                        debugMode: false,
                        testMode: false
                    }
                })
            }
        });
        
        if (created) {
            console.log('✅ Default system settings created');
        } else {
            console.log('ℹ️ System settings already exist');
        }
        
        // Create sample template for testing
        console.log('📝 Creating sample template...');
        const [template, templateCreated] = await Template.findOrCreate({
            where: { name: 'Welcome Message' },
            defaults: {
                name: 'Welcome Message',
                category: 'marketing',
                body: 'Hello {{name}}! Welcome to our service. We are glad to have you on board.',
                variables: ['name'],
                language: 'en',
                status: 'active'
            }
        });
        
        if (templateCreated) {
            console.log('✅ Sample template created');
        } else {
            console.log('ℹ️ Sample template already exists');
        }
        
        console.log('🎉 Database initialization completed successfully!');
        console.log('\n📋 Summary:');
        console.log('   - Main tables: Messages, Contacts, Chats, Groups, WebhookLogs');
        console.log('   - Bulk messaging tables: Templates, Audiences, Campaigns, Sends, DND, SystemSettings');
        console.log('   - Default settings and sample data created');
        console.log('\n🚀 You can now start the server with: npm start');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        console.error('Error details:', error.message);
        
        // Additional error information for debugging
        if (error.parent) {
            console.error('Database error:', error.parent.message);
        }
        
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Run initialization if this file is executed directly
if (require.main === module) {
    initializeDatabase();
}

module.exports = { initializeDatabase };
