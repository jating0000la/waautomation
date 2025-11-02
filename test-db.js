const { Sequelize } = require('sequelize');

const seq = new Sequelize('postgresql://postgres:admin@localhost:5432/whatsapp', {
    dialect: 'postgres',
    logging: false
});

seq.authenticate()
    .then(() => {
        console.log('✅ Database Connected');
        return seq.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
            { type: Sequelize.QueryTypes.SELECT }
        );
    })
    .then(tables => {
        console.log('📊 Database Tables:');
        console.log(JSON.stringify(tables, null, 2));
        return seq.close();
    })
    .then(() => process.exit(0))
    .catch(e => {
        console.error('❌ Database Error:', e.message);
        process.exit(1);
    });
