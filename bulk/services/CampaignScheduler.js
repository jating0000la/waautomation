const cron = require('node-cron');
const { Campaign, Send, Audience, Template } = require('../models');
const MessageScheduler = require('./MessageScheduler');

class CampaignScheduler {
    constructor() {
        this.activeSchedules = new Map();
        this.isRunning = false;
        this.MAX_CONCURRENT_CAMPAIGNS = 3;
    }

    start() {
        if (this.isRunning) return;
        
        console.log('Campaign Scheduler starting...');
        this.isRunning = true;
        
        // Check for campaigns every minute
        cron.schedule('* * * * *', async () => {
            await this.checkPendingCampaigns();
        });

        // Resume interrupted campaigns on startup
        this.resumeInterruptedCampaigns();
    }

    stop() {
        console.log('Campaign Scheduler stopping...');
        this.isRunning = false;
        
        // Stop all active schedules
        this.activeSchedules.forEach((schedule, campaignId) => {
            if (schedule.destroy) schedule.destroy();
        });
        this.activeSchedules.clear();
    }

    async checkPendingCampaigns() {
        try {
            const now = new Date();
            
            // Find campaigns that should start now
            const pendingCampaigns = await Campaign.findAll({
                where: {
                    status: 'scheduled',
                    scheduledAt: {
                        [require('sequelize').Op.lte]: now
                    }
                }
            });

            for (const campaign of pendingCampaigns) {
                await this.startCampaign(campaign.id);
            }

        } catch (error) {
            console.error('Error checking pending campaigns:', error);
        }
    }

    async startCampaign(campaign) {
        try {
            // Check concurrency limit
            if (this.activeSchedules.size >= this.MAX_CONCURRENT_CAMPAIGNS) {
                throw new Error(`Maximum concurrent campaigns reached (${this.MAX_CONCURRENT_CAMPAIGNS})`);
            }
            
            // Accept campaign instance or id
            if (typeof campaign === 'string') {
                campaign = await Campaign.findByPk(campaign, { include: [{ model: Template, as: 'template' }] });
            } else if (!campaign.template) {
                // Reload with template relation if missing
                campaign = await Campaign.findByPk(campaign.id, { include: [{ model: Template, as: 'template' }] });
            }
            if (!campaign) throw new Error('Campaign not found');
            console.log(`Starting campaign: ${campaign.name} (ID: ${campaign.id})`);
            
            // Update campaign status
            await campaign.update({ 
                status: 'running',
                startedAt: new Date()
            });

            // Get audience members using the same logic as campaign creation
            const sequelize = require('sequelize');
            let whereClause = {};
            
            // Extract audienceId from segmentFilter
            const audienceId = campaign.segmentFilter?.audienceId || 'main_list';
            console.log(`Campaign ${campaign.id} - targeting audience: ${audienceId}`);

            switch (audienceId) {
                case 'main_list':
                    whereClause = { consentStatus: 'opted_in' };
                    break;
                case 'all_contacts':
                    // No consent filter: include opted_in, unknown, opted_out (use with caution)
                    whereClause = {}; 
                    break;
                case 'vip_customers':
                    whereClause = { 
                        consentStatus: 'opted_in',
                        tags: { [sequelize.Op.contains]: ['vip'] }
                    };
                    break;
                case 'new_subscribers':
                    whereClause = { 
                        consentStatus: 'opted_in',
                        importedAt: {
                            [sequelize.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                        }
                    };
                    break;
                case 'promotional':
                    whereClause = { 
                        consentStatus: 'opted_in',
                        tags: { [sequelize.Op.contains]: ['promotional'] }
                    };
                    break;
                default:
                    whereClause = { consentStatus: 'opted_in' };
            }

            console.log(`Campaign ${campaign.id} - audience query:`, JSON.stringify(whereClause, null, 2));

            // Get audience members with soft delete filter
            const audienceMembers = await Audience.findAll({
                where: { ...whereClause, isDeleted: false }
            });

            if (audienceMembers.length === 0) {
                await campaign.update({ 
                    status: 'completed',
                    completedAt: new Date(),
                    errorMessage: 'No valid audience members found'
                });
                return;
            }

            // Create message scheduler for this campaign
            const scheduler = new MessageScheduler(campaign, audienceMembers);
            this.activeSchedules.set(campaign.id, scheduler);

            // Start sending messages
            await scheduler.start();

        } catch (error) {
            console.error(`Error starting campaign ${campaign.id}:`, error);
            await campaign.update({ 
                status: 'failed',
                errorMessage: error.message
            });
            throw error; // Re-throw to notify caller
        }
    }

    async pauseCampaign(campaignId) {
        try {
            const campaign = await Campaign.findByPk(campaignId);
            if (!campaign) throw new Error('Campaign not found');

            // Stop the scheduler
            const scheduler = this.activeSchedules.get(campaignId);
            if (scheduler) {
                await scheduler.pause();
            }

            // Update campaign status
            await campaign.update({ 
                status: 'paused',
                pausedAt: new Date()
            });

            console.log(`Campaign ${campaignId} paused`);
            return true;

        } catch (error) {
            console.error(`Error pausing campaign ${campaignId}:`, error);
            return false;
        }
    }

    async resumeCampaign(campaignId) {
        try {
            const campaign = await Campaign.findByPk(campaignId, {
                include: [
                    { model: Template, as: 'template' },
                    { model: Audience, as: 'audience' }
                ]
            });
            
            if (!campaign) throw new Error('Campaign not found');

            // Get remaining audience members
            const sentPhones = await Send.findAll({
                where: { campaignId },
                attributes: ['phone']
            }).then(sends => sends.map(s => s.phone));

            // Use the same audience selection logic
            const sequelize = require('sequelize');
            let whereClause = {};
            
            const audienceId = campaign.segmentFilter?.audienceId || 'main_list';

            switch (audienceId) {
                case 'main_list':
                    whereClause = { consentStatus: 'opted_in' };
                    break;
                case 'vip_customers':
                    whereClause = { 
                        consentStatus: 'opted_in',
                        tags: { [sequelize.Op.contains]: ['vip'] }
                    };
                    break;
                case 'new_subscribers':
                    whereClause = { 
                        consentStatus: 'opted_in',
                        importedAt: {
                            [sequelize.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    };
                    break;
                case 'promotional':
                    whereClause = { 
                        consentStatus: 'opted_in',
                        tags: { [sequelize.Op.contains]: ['promotional'] }
                    };
                    break;
                default:
                    whereClause = { consentStatus: 'opted_in' };
            }

            // Add condition to exclude already sent phones
            if (sentPhones.length > 0) {
                whereClause.phone = {
                    [sequelize.Op.notIn]: sentPhones
                };
            }

            const remainingMembers = await Audience.findAll({
                where: { ...whereClause, isDeleted: false }
            });

            if (remainingMembers.length === 0) {
                await campaign.update({ 
                    status: 'completed',
                    completedAt: new Date()
                });
                return true;
            }

            // Create new scheduler for remaining members
            const scheduler = new MessageScheduler(campaign, remainingMembers);
            this.activeSchedules.set(campaign.id, scheduler);

            // Update campaign status and resume
            await campaign.update({ 
                status: 'running',
                resumedAt: new Date()
            });

            await scheduler.start();
            console.log(`Campaign ${campaignId} resumed`);
            return true;

        } catch (error) {
            console.error(`Error resuming campaign ${campaignId}:`, error);
            return false;
        }
    }

    async stopCampaign(campaignId) {
        try {
            const campaign = await Campaign.findByPk(campaignId);
            if (!campaign) throw new Error('Campaign not found');

            // Stop the scheduler
            const scheduler = this.activeSchedules.get(campaignId);
            if (scheduler) {
                await scheduler.stop();
                // Clean up completed campaign from memory
                this.activeSchedules.delete(campaignId);
            }

            // Update campaign status
            await campaign.update({ 
                status: 'stopped',
                stoppedAt: new Date()
            });

            console.log(`Campaign ${campaignId} stopped`);
            return true;

        } catch (error) {
            console.error(`Error stopping campaign ${campaignId}:`, error);
            return false;
        }
    }

    async resumeInterruptedCampaigns() {
        try {
            // Find campaigns that were running when system stopped
            const interruptedCampaigns = await Campaign.findAll({
                where: {
                    status: 'running'
                }
            });

            for (const campaign of interruptedCampaigns) {
                console.log(`Resuming interrupted campaign: ${campaign.name}`);
                await this.resumeCampaign(campaign.id);
            }

        } catch (error) {
            console.error('Error resuming interrupted campaigns:', error);
        }
    }

    getCampaignStatus(campaignId) {
        const scheduler = this.activeSchedules.get(campaignId);
        if (!scheduler) return null;
        
        return scheduler.getStatus();
    }

    getAllActiveCampaigns() {
        const active = {};
        this.activeSchedules.forEach((scheduler, campaignId) => {
            active[campaignId] = scheduler.getStatus();
        });
        return active;
    }
}

module.exports = CampaignScheduler;
