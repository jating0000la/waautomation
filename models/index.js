const Message = require('./Message');
const Contact = require('./Contact');
const Group = require('./Group');
const Chat = require('./Chat');
const WebhookLog = require('./WebhookLog');

// Remove associations for now to avoid foreign key issues
// We'll use string references instead of proper foreign keys

module.exports = {
    Message,
    Contact,
    Group,
    Chat,
    WebhookLog
};
