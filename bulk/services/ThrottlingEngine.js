const { SystemSettings, Send, DND } = require('../models');

class ThrottlingEngine {
    constructor() {
        this.messageQueue = [];
        this.isProcessing = false;
        this.stats = {
            sentToday: 0,
            sentThisHour: 0,
            sentThisMinute: 0,
            lastReset: {
                day: new Date().getDate(),
                hour: new Date().getHours(),
                minute: new Date().getMinutes()
            }
        };
        
        // Reset counters periodically
        this.startCounterResetTimer();
    }

    async initialize() {
        // Load today's sent count from database
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaysSends = await Send.count({
            where: {
                sentAt: {
                    [require('sequelize').Op.gte]: today
                },
                status: 'sent'
            }
        });
        
        this.stats.sentToday = todaysSends;
        console.log(`Throttling Engine initialized. Today's sent messages: ${todaysSends}`);
    }

    async canSendMessage() {
        const settings = await this.getSettings();
        const now = new Date();
        
        // Reset counters if needed
        this.resetCountersIfNeeded(now);
        
        // Check daily limit
        if (this.stats.sentToday >= settings.messagesPerDay) {
            return {
                canSend: false,
                reason: 'daily_limit_exceeded',
                waitTime: this.getTimeUntilNextDay()
            };
        }
        
        // Check hourly limit
        if (this.stats.sentThisHour >= settings.messagesPerHour) {
            return {
                canSend: false,
                reason: 'hourly_limit_exceeded',
                waitTime: this.getTimeUntilNextHour()
            };
        }
        
        // Check per-minute limit
        if (this.stats.sentThisMinute >= settings.messagesPerMinute) {
            return {
                canSend: false,
                reason: 'minute_limit_exceeded',
                waitTime: this.getTimeUntilNextMinute()
            };
        }
        
        // Check warmup mode
        if (settings.warmupMode && this.stats.sentToday >= settings.warmupLimit) {
            return {
                canSend: false,
                reason: 'warmup_limit_exceeded',
                waitTime: this.getTimeUntilNextDay()
            };
        }
        
        return { canSend: true };
    }

    async getOptimalDelay() {
        const settings = await this.getSettings();
        
        // Base delay calculation
        const baseDelayMs = (60 * 1000) / settings.messagesPerMinute;
        
        // Apply warmup mode slower sending
        const warmupMultiplier = settings.warmupMode ? 2 : 1;
        
        // Add randomization (±30%) to avoid pattern detection
        const randomFactor = 0.7 + (Math.random() * 0.6);
        
        // Calculate final delay
        const delay = baseDelayMs * warmupMultiplier * randomFactor;
        
        // Ensure minimum delay
        return Math.max(delay, 2000);
    }

    async recordMessageSent() {
        this.stats.sentToday++;
        this.stats.sentThisHour++;
        this.stats.sentThisMinute++;
        
        console.log(`Message sent. Stats - Today: ${this.stats.sentToday}, Hour: ${this.stats.sentThisHour}, Minute: ${this.stats.sentThisMinute}`);
    }

    resetCountersIfNeeded(now) {
        // Reset minute counter
        if (now.getMinutes() !== this.stats.lastReset.minute) {
            this.stats.sentThisMinute = 0;
            this.stats.lastReset.minute = now.getMinutes();
        }
        
        // Reset hour counter
        if (now.getHours() !== this.stats.lastReset.hour) {
            this.stats.sentThisHour = 0;
            this.stats.lastReset.hour = now.getHours();
        }
        
        // Reset day counter
        if (now.getDate() !== this.stats.lastReset.day) {
            this.stats.sentToday = 0;
            this.stats.lastReset.day = now.getDate();
        }
    }

    startCounterResetTimer() {
        // Check every minute for counter resets
        setInterval(() => {
            this.resetCountersIfNeeded(new Date());
        }, 60000);
    }

    getTimeUntilNextMinute() {
        const now = new Date();
        const nextMinute = new Date(now);
        nextMinute.setMinutes(now.getMinutes() + 1, 0, 0);
        return nextMinute.getTime() - now.getTime();
    }

    getTimeUntilNextHour() {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        return nextHour.getTime() - now.getTime();
    }

    getTimeUntilNextDay() {
        const now = new Date();
        const nextDay = new Date(now);
        nextDay.setDate(now.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
        return nextDay.getTime() - now.getTime();
    }

    async getSettings() {
        const settings = await SystemSettings.findOne();
        return {
            messagesPerMinute: settings?.messagesPerMinute || 10,
            messagesPerHour: settings?.messagesPerHour || 300,
            messagesPerDay: settings?.messagesPerDay || 1000,
            warmupMode: settings?.warmupMode || false,
            warmupLimit: settings?.warmupLimit || 50
        };
    }

    async checkAccountHealth() {
        const settings = await this.getSettings();
        const healthScore = await this.calculateHealthScore();
        
        if (healthScore < 50) {
            // Reduce sending rate
            const newRate = Math.max(settings.messagesPerMinute * 0.5, 1);
            await this.updateSettings({ messagesPerMinute: newRate });
            
            console.log(`Account health low (${healthScore}%), reducing rate to ${newRate} messages/minute`);
            
            return {
                healthy: false,
                score: healthScore,
                action: 'rate_reduced',
                newRate: newRate
            };
        }
        
        if (healthScore > 80 && !settings.warmupMode) {
            // Gradually increase rate
            const newRate = Math.min(settings.messagesPerMinute * 1.1, 20);
            await this.updateSettings({ messagesPerMinute: newRate });
            
            console.log(`Account health good (${healthScore}%), increasing rate to ${newRate} messages/minute`);
            
            return {
                healthy: true,
                score: healthScore,
                action: 'rate_increased',
                newRate: newRate
            };
        }
        
        return {
            healthy: healthScore >= 50,
            score: healthScore,
            action: 'none'
        };
    }

    async calculateHealthScore() {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        // Get recent send statistics
        const recentSends = await Send.findAll({
            where: {
                sentAt: {
                    [require('sequelize').Op.gte]: last24Hours
                }
            }
        });
        
        if (recentSends.length === 0) return 100;
        
        const successful = recentSends.filter(s => s.status === 'sent').length;
        const failed = recentSends.filter(s => s.status === 'failed').length;
        
        // Calculate success rate
        const successRate = (successful / recentSends.length) * 100;
        
        // Check for recent DND additions (could indicate complaints)
        const recentDnd = await DND.count({
            where: {
                createdAt: {
                    [require('sequelize').Op.gte]: last24Hours
                }
            }
        });
        
        // Health score calculation
        let healthScore = successRate;
        
        // Penalize for recent DND additions
        if (recentDnd > 0) {
            healthScore -= (recentDnd * 5); // -5 points per DND addition
        }
        
        // Penalize for high failure rate
        const failureRate = (failed / recentSends.length) * 100;
        if (failureRate > 10) {
            healthScore -= (failureRate - 10);
        }
        
        return Math.max(0, Math.min(100, healthScore));
    }

    async updateSettings(newSettings) {
        const settings = await SystemSettings.findOne();
        if (settings) {
            await settings.update(newSettings);
        }
    }

    getStatus() {
        return {
            stats: { ...this.stats },
            isProcessing: this.isProcessing,
            queueLength: this.messageQueue.length
        };
    }

    async getBanRiskAssessment() {
        const healthScore = await this.calculateHealthScore();
        const settings = await this.getSettings();
        
        let riskLevel = 'low';
        let recommendations = [];
        
        if (healthScore < 30) {
            riskLevel = 'high';
            recommendations.push('Consider pausing campaigns for 24-48 hours');
            recommendations.push('Review message content for spam-like characteristics');
            recommendations.push('Enable warmup mode with very low limits');
        } else if (healthScore < 60) {
            riskLevel = 'medium';
            recommendations.push('Reduce sending rate by 50%');
            recommendations.push('Enable warmup mode');
            recommendations.push('Review recent failed messages');
        } else if (this.stats.sentToday > settings.messagesPerDay * 0.8) {
            riskLevel = 'medium';
            recommendations.push('Close to daily limit, consider slowing down');
        }
        
        return {
            riskLevel,
            healthScore,
            recommendations,
            dailyUsage: (this.stats.sentToday / settings.messagesPerDay * 100).toFixed(1),
            hourlyUsage: (this.stats.sentThisHour / settings.messagesPerHour * 100).toFixed(1)
        };
    }
}

module.exports = ThrottlingEngine;
