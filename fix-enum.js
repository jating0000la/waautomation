const { sequelize } = require('./database');

async function fixEnums() {
    try {
        console.log('🔧 Fixing database enums...');
        
        // Add 'chat' to Messages type enum
        await sequelize.query('ALTER TYPE "public"."enum_Messages_type" ADD VALUE IF NOT EXISTS \'chat\'');
        console.log('✅ Added "chat" to enum_Messages_type');
        
        console.log('🎉 Enum fixes completed successfully!');
        process.exit(0);
    } catch (error) {
        console.log('⚠️ Error or value already exists:', error.message);
        process.exit(0);
    }
}

fixEnums();
