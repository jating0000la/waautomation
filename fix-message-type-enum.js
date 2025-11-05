/**
 * Fix Message Type Enum - Add missing message types
 * Run this script to update the database enum without losing data
 */

const { sequelize } = require('./database');

async function fixMessageTypeEnum() {
    console.log('🔧 Starting Message Type Enum Fix...');
    
    try {
        // Check database connection
        await sequelize.authenticate();
        console.log('✅ Database connection established');

        // New enum values to add
        const newTypes = [
            'notification_template',
            'ptt',
            'call_log',
            'ciphertext',
            'buttons_response',
            'template_button_reply'
        ];

        console.log('\n📝 Adding new message types to enum...');

        // Add new enum values one by one
        for (const type of newTypes) {
            try {
                await sequelize.query(`
                    ALTER TYPE "enum_Messages_type" 
                    ADD VALUE IF NOT EXISTS '${type}';
                `);
                console.log(`  ✓ Added type: ${type}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`  ⊙ Type already exists: ${type}`);
                } else {
                    console.error(`  ✗ Error adding ${type}:`, error.message);
                }
            }
        }

        console.log('\n✅ Message type enum updated successfully!');
        console.log('📊 Current enum values:');
        
        // Show current enum values
        const [results] = await sequelize.query(`
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (
                SELECT oid 
                FROM pg_type 
                WHERE typname = 'enum_Messages_type'
            )
            ORDER BY enumsortorder;
        `);
        
        results.forEach(row => {
            console.log(`  • ${row.enumlabel}`);
        });

        console.log('\n🎉 All done! You can now restart your server.');
        
    } catch (error) {
        console.error('\n❌ Error fixing enum:', error);
        console.error('\nIf you see "enum already exists" errors, that\'s OK!');
        console.error('If you see other errors, you may need to run: node migrate-database.js');
    } finally {
        await sequelize.close();
    }
}

// Run the fix
fixMessageTypeEnum();
