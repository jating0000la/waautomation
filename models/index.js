const { sequelize } = require('../database');
const Message = require('./Message');
const Contact = require('./Contact');
const Group = require('./Group');
const Chat = require('./Chat');
const WebhookLog = require('./WebhookLog');
const WhatsAppAccount = require('./WhatsAppAccount');
const ApiLog = require('./ApiLog');

// Initialize models that require sequelize instance
const ApiKey = require('./ApiKey')(sequelize);
const WebhookConfig = require('./WebhookConfig')(sequelize);

// Remove associations for now to avoid foreign key issues
// We'll use string references instead of proper foreign keys

module.exports = {
    Message,
    Contact,
    Group,
    Chat,
    WebhookLog,
    WhatsAppAccount,
    ApiKey,
    WebhookConfig,
    ApiLog,
    sequelize // Export sequelize instance for use in routes
};
