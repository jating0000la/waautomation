const { Sequelize } = require('sequelize');

const seq = new Sequelize('postgresql://postgres:admin@localhost:5432/whatsapp', {
    dialect: 'postgres',
    logging: false
});

async function auditSystem() {
    try {
        await seq.authenticate();
        console.log('✅ Database Connected\n');

        // Check table counts
        console.log('📊 TABLE DATA COUNTS:');
        const tables = ['Audiences', 'Templates', 'Campaigns', 'Sends', 'DNDs', 
                       'ComplianceRules', 'ComplianceAudits', 'SystemSettings'];
        
        for (const table of tables) {
            const result = await seq.query(
                `SELECT COUNT(*) as count FROM "${table}"`,
                { type: Sequelize.QueryTypes.SELECT }
            );
            console.log(`  ${table}: ${result[0].count} records`);
        }

        // Check Campaigns status
        console.log('\n🎯 CAMPAIGNS STATUS:');
        const campaigns = await seq.query(
            `SELECT id, name, status, "totalRecipients", "sentCount", "failedCount", "createdAt" 
             FROM "Campaigns" ORDER BY "createdAt" DESC LIMIT 5`,
            { type: Sequelize.QueryTypes.SELECT }
        );
        
        if (campaigns.length === 0) {
            console.log('  No campaigns found');
        } else {
            campaigns.forEach(c => {
                console.log(`  - ${c.name} (${c.status}): ${c.sentCount || 0}/${c.totalRecipients || 0} sent, ${c.failedCount || 0} failed`);
            });
        }

        // Check Templates
        console.log('\n📝 TEMPLATES:');
        const templates = await seq.query(
            `SELECT id, name, category FROM "Templates" ORDER BY "createdAt" DESC LIMIT 5`,
            { type: Sequelize.QueryTypes.SELECT }
        );
        
        if (templates.length === 0) {
            console.log('  No templates found');
        } else {
            templates.forEach(t => {
                console.log(`  - ${t.name} (${t.category})`);
            });
        }

        // Check Audiences with consent status
        console.log('\n👥 AUDIENCE BREAKDOWN:');
        const audienceStatus = await seq.query(
            `SELECT "consentStatus", COUNT(*) as count 
             FROM "Audiences" 
             WHERE ("isDeleted" IS NULL OR "isDeleted" = false)
             GROUP BY "consentStatus"`,
            { type: Sequelize.QueryTypes.SELECT }
        );
        
        if (audienceStatus.length === 0) {
            console.log('  No audience members found');
        } else {
            audienceStatus.forEach(s => {
                console.log(`  ${s.consentStatus || 'unknown'}: ${s.count} contacts`);
            });
        }

        // Check DND list
        console.log('\n🚫 DND (Do Not Disturb):');
        const dndSources = await seq.query(
            `SELECT "source", COUNT(*) as count 
             FROM "DNDs" 
             GROUP BY "source"`,
            { type: Sequelize.QueryTypes.SELECT }
        );
        
        if (dndSources.length === 0) {
            console.log('  DND list is empty');
        } else {
            dndSources.forEach(s => {
                console.log(`  ${s.source || 'unknown'}: ${s.count} numbers`);
            });
        }

        // Check System Settings
        console.log('\n⚙️ SYSTEM SETTINGS:');
        const settings = await seq.query(
            `SELECT key, value FROM "SystemSettings"`,
            { type: Sequelize.QueryTypes.SELECT }
        );
        
        if (settings.length === 0) {
            console.log('  No system settings configured (using defaults)');
        } else {
            settings.forEach(s => {
                console.log(`  ${s.key}: ${JSON.stringify(s.value)}`);
            });
        }

        // Check recent Send activity
        console.log('\n📤 RECENT SEND ACTIVITY (Last 24h):');
        const recentSends = await seq.query(
            `SELECT status, COUNT(*) as count 
             FROM "Sends" 
             WHERE "createdAt" > NOW() - INTERVAL '24 hours'
             GROUP BY status`,
            { type: Sequelize.QueryTypes.SELECT }
        );
        
        if (recentSends.length === 0) {
            console.log('  No sends in last 24 hours');
        } else {
            recentSends.forEach(s => {
                console.log(`  ${s.status}: ${s.count} messages`);
            });
        }

        await seq.close();
        console.log('\n✅ Audit Complete');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Audit Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

auditSystem();
