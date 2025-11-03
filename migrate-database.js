const { sequelize } = require('./database');
const { QueryTypes } = require('sequelize');

/**
 * Database migration script for multi-account WhatsApp system
 * This script will:
 * 1. Create the new whatsapp_accounts table
 * 2. Add phone_id columns to existing tables
 * 3. Create necessary indexes
 * 4. Handle existing data migration
 */

async function runMigration() {
    console.log('🔄 Starting database migration for multi-account system...');
    
    try {
        // Start transaction
        const transaction = await sequelize.transaction();
        
        try {
            // 1. Create whatsapp_accounts table if it doesn't exist
            console.log('📋 Creating whatsapp_accounts table...');
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS "whatsapp_accounts" (
                    "id" SERIAL PRIMARY KEY,
                    "phone_id" VARCHAR(50) UNIQUE NOT NULL,
                    "phone_number" VARCHAR(20),
                    "token" VARCHAR(255) UNIQUE NOT NULL,
                    "name" VARCHAR(100),
                    "status" VARCHAR(20) DEFAULT 'pending' CHECK ("status" IN ('pending', 'connected', 'disconnected', 'failed')),
                    "qr_code" TEXT,
                    "session_data" JSONB,
                    "last_activity" TIMESTAMP,
                    "webhook_url" VARCHAR(500),
                    "webhook_events" JSONB DEFAULT '["message", "status"]',
                    "settings" JSONB DEFAULT '{"auto_reply": false, "message_logging": true, "media_download": true}',
                    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `, { transaction });
            
            // Create indexes for whatsapp_accounts
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS "whatsapp_accounts_phone_id_idx" ON "whatsapp_accounts" ("phone_id");
                CREATE INDEX IF NOT EXISTS "whatsapp_accounts_token_idx" ON "whatsapp_accounts" ("token");
                CREATE INDEX IF NOT EXISTS "whatsapp_accounts_status_idx" ON "whatsapp_accounts" ("status");
            `, { transaction });
            
            // 2. Check if phone_id column exists in Messages table
            console.log('📋 Checking Messages table schema...');
            const messagesColumns = await sequelize.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'Messages' AND column_name = 'phone_id';
            `, { type: QueryTypes.SELECT, transaction });
            
            if (messagesColumns.length === 0) {
                console.log('➕ Adding phone_id column to Messages table...');
                await sequelize.query(`
                    ALTER TABLE "Messages" ADD COLUMN "phone_id" VARCHAR(50);
                `, { transaction });
                
                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS "messages_phone_id_idx" ON "Messages" ("phone_id");
                `, { transaction });
            } else {
                console.log('✅ phone_id column already exists in Messages table');
            }
            
            // 3. Check if phone_id column exists in Contacts table
            console.log('📋 Checking Contacts table schema...');
            const contactsColumns = await sequelize.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'Contacts' AND column_name = 'phone_id';
            `, { type: QueryTypes.SELECT, transaction });
            
            if (contactsColumns.length === 0) {
                console.log('➕ Adding phone_id column to Contacts table...');
                await sequelize.query(`
                    ALTER TABLE "Contacts" ADD COLUMN "phone_id" VARCHAR(50);
                `, { transaction });
                
                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS "contacts_phone_id_idx" ON "Contacts" ("phone_id");
                `, { transaction });
            } else {
                console.log('✅ phone_id column already exists in Contacts table');
            }
            
            // 4. Check if phone_id column exists in Chats table
            console.log('📋 Checking Chats table schema...');
            const chatsColumns = await sequelize.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'Chats' AND column_name = 'phone_id';
            `, { type: QueryTypes.SELECT, transaction });
            
            if (chatsColumns.length === 0) {
                console.log('➕ Adding phone_id column to Chats table...');
                await sequelize.query(`
                    ALTER TABLE "Chats" ADD COLUMN "phone_id" VARCHAR(50);
                `, { transaction });
                
                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS "chats_phone_id_idx" ON "Chats" ("phone_id");
                `, { transaction });
            } else {
                console.log('✅ phone_id column already exists in Chats table');
            }
            
            // 5. Create a default legacy account for existing data
            console.log('📋 Creating default legacy account...');
            const existingAccount = await sequelize.query(`
                SELECT * FROM "whatsapp_accounts" WHERE "phone_id" = 'legacy';
            `, { type: QueryTypes.SELECT, transaction });
            
            if (existingAccount.length === 0) {
                // Generate a token for the legacy account
                const crypto = require('crypto');
                const legacyToken = crypto.randomBytes(32).toString('hex');
                
                await sequelize.query(`
                    INSERT INTO "whatsapp_accounts" 
                    ("phone_id", "token", "name", "status", "created_at", "updated_at") 
                    VALUES 
                    ('legacy', :token, 'Legacy Account', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                `, { 
                    replacements: { token: legacyToken }, 
                    transaction 
                });
                
                console.log(`✅ Created legacy account with token: ${legacyToken}`);
                console.log('⚠️  IMPORTANT: Save this token for backward compatibility!');
                
                // Update existing data to associate with legacy account
                console.log('📋 Updating existing data to associate with legacy account...');
                
                // Update Messages
                const messagesCount = await sequelize.query(`
                    UPDATE "Messages" SET "phone_id" = 'legacy' WHERE "phone_id" IS NULL;
                `, { transaction });
                
                // Update Contacts  
                const contactsCount = await sequelize.query(`
                    UPDATE "Contacts" SET "phone_id" = 'legacy' WHERE "phone_id" IS NULL;
                `, { transaction });
                
                // Update Chats
                const chatsCount = await sequelize.query(`
                    UPDATE "Chats" SET "phone_id" = 'legacy' WHERE "phone_id" IS NULL;
                `, { transaction });
                
                console.log(`✅ Updated existing data to use legacy account`);
            } else {
                console.log('✅ Legacy account already exists');
            }
            
            // 6. Verify table structures
            console.log('🔍 Verifying table structures...');
            
            const tableInfo = await sequelize.query(`
                SELECT 
                    t.table_name,
                    COUNT(c.column_name) as column_count
                FROM information_schema.tables t
                LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
                WHERE t.table_schema = 'public' 
                AND t.table_name IN ('whatsapp_accounts', 'Messages', 'Contacts', 'Chats')
                GROUP BY t.table_name
                ORDER BY t.table_name;
            `, { type: QueryTypes.SELECT, transaction });
            
            console.log('📊 Table structures:');
            tableInfo.forEach(table => {
                console.log(`  ${table.table_name}: ${table.column_count} columns`);
            });
            
            // Check whatsapp_accounts columns specifically
            const accountsColumns = await sequelize.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'whatsapp_accounts' 
                ORDER BY ordinal_position;
            `, { type: QueryTypes.SELECT, transaction });
            
            console.log(`  whatsapp_accounts columns: ${accountsColumns.map(c => c.column_name).join(', ')}`);
            
            // Commit transaction
            await transaction.commit();
            console.log('✅ Database migration completed successfully!');
            
            return true;
            
        } catch (error) {
            // Rollback transaction on error
            await transaction.rollback();
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Function to check current database state
async function auditDatabase() {
    console.log('🔍 Auditing database schema...');
    
    try {
        // Check if main tables exist
        const tables = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('whatsapp_accounts', 'Messages', 'Contacts', 'Chats', 'Groups');
        `, { type: QueryTypes.SELECT });
        
        console.log('📋 Existing tables:', tables.map(t => t.table_name).join(', '));
        
        // Check whatsapp_accounts table
        const accountsTableExists = tables.some(t => t.table_name === 'whatsapp_accounts');
        if (accountsTableExists) {
            const accountsCount = await sequelize.query(`
                SELECT COUNT(*) as count FROM "whatsapp_accounts";
            `, { type: QueryTypes.SELECT });
            console.log(`📊 WhatsApp accounts: ${accountsCount[0].count}`);
            
            const accountsStatus = await sequelize.query(`
                SELECT status, COUNT(*) as count 
                FROM "whatsapp_accounts" 
                GROUP BY status;
            `, { type: QueryTypes.SELECT });
            console.log('📊 Account status breakdown:', accountsStatus);
        } else {
            console.log('❌ whatsapp_accounts table does not exist');
        }
        
        // Check phone_id columns
        for (const tableName of ['Messages', 'Contacts', 'Chats']) {
            const phoneIdColumn = await sequelize.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = :tableName AND column_name = 'phone_id';
            `, { 
                type: QueryTypes.SELECT,
                replacements: { tableName }
            });
            
            if (phoneIdColumn.length > 0) {
                // Check data distribution
                const phoneIdData = await sequelize.query(`
                    SELECT 
                        "phone_id", 
                        COUNT(*) as count 
                    FROM "${tableName}" 
                    WHERE "phone_id" IS NOT NULL
                    GROUP BY "phone_id"
                    ORDER BY count DESC;
                `, { type: QueryTypes.SELECT });
                
                console.log(`📊 ${tableName} phone_id distribution:`, phoneIdData);
            } else {
                console.log(`❌ ${tableName} table missing phone_id column`);
            }
        }
        
    } catch (error) {
        console.error('❌ Database audit failed:', error);
    }
}

module.exports = {
    runMigration,
    auditDatabase
};

// Run migration if this file is executed directly
if (require.main === module) {
    (async () => {
        try {
            await auditDatabase();
            console.log('\n' + '='.repeat(60) + '\n');
            await runMigration();
            console.log('\n' + '='.repeat(60) + '\n');
            await auditDatabase();
        } catch (error) {
            console.error('❌ Script failed:', error);
            process.exit(1);
        } finally {
            await sequelize.close();
        }
    })();
}