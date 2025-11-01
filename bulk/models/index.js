const Template = require('./Template');
const Audience = require('./Audience');
const Campaign = require('./Campaign');
const Send = require('./Send');
const DND = require('./DND');
const SystemSettings = require('./SystemSettings');
const ComplianceRule = require('./ComplianceRule');
const ComplianceAudit = require('./ComplianceAudit');

// Define associations
Campaign.belongsTo(Template, { foreignKey: 'templateId', as: 'template' });
Template.hasMany(Campaign, { foreignKey: 'templateId', as: 'campaigns' });

Send.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
Send.belongsTo(Audience, { foreignKey: 'audienceId', as: 'audience' });

Campaign.hasMany(Send, { foreignKey: 'campaignId', as: 'sends' });
Audience.hasMany(Send, { foreignKey: 'audienceId', as: 'sends' });

module.exports = {
    Template,
    Audience,
    Campaign,
    Send,
    DND,
    SystemSettings,
    ComplianceRule,
    ComplianceAudit
};
