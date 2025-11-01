const { DND, Send, Template, Campaign } = require('../models');

class ComplianceChecker {
    static spamKeywords = [
        'free', 'win', 'winner', 'cash', 'money', 'urgent', 'hurry', 'limited time',
        'act now', 'call now', 'click here', 'guarantee', '100%', 'risk free',
        'no obligation', 'congratulations', 'selected', 'winner', 'prize'
    ];

    static restrictedCategories = [
        'gambling', 'adult', 'pharmaceutical', 'cryptocurrency', 'mlm',
        'get-rich-quick', 'weight-loss', 'dating'
    ];

    static async checkMessage(messageContent, templateId = null, recipientPhone = null) {
        const violations = [];
        const warnings = [];
        let riskScore = 0;

        // Check content compliance
        const contentCheck = this.checkMessageContent(messageContent);
        violations.push(...contentCheck.violations);
        warnings.push(...contentCheck.warnings);
        riskScore += contentCheck.riskScore;

        // Check template compliance if templateId provided
        if (templateId) {
            const templateCheck = await this.checkTemplate(templateId);
            violations.push(...templateCheck.violations);
            warnings.push(...templateCheck.warnings);
            riskScore += templateCheck.riskScore;
        }

        // Check recipient compliance if phone provided
        if (recipientPhone) {
            const recipientCheck = await this.checkRecipient(recipientPhone);
            violations.push(...recipientCheck.violations);
            warnings.push(...recipientCheck.warnings);
            riskScore += recipientCheck.riskScore;
        }

        // Overall compliance assessment
        const isCompliant = violations.length === 0 && riskScore < 50;
        const riskLevel = this.calculateRiskLevel(riskScore);

        return {
            isCompliant,
            riskLevel,
            riskScore,
            violations,
            warnings,
            recommendations: this.generateRecommendations(violations, warnings, riskScore)
        };
    }

    static checkMessageContent(content) {
        const violations = [];
        const warnings = [];
        let riskScore = 0;

        if (!content || content.trim().length === 0) {
            violations.push('Empty message content');
            return { violations, warnings, riskScore: 100 };
        }

        const lowerContent = content.toLowerCase();

        // Check for spam keywords
        const foundSpamKeywords = this.spamKeywords.filter(keyword => 
            lowerContent.includes(keyword.toLowerCase())
        );
        
        if (foundSpamKeywords.length > 0) {
            riskScore += foundSpamKeywords.length * 5;
            if (foundSpamKeywords.length > 3) {
                violations.push(`Multiple spam keywords found: ${foundSpamKeywords.join(', ')}`);
            } else {
                warnings.push(`Potential spam keywords: ${foundSpamKeywords.join(', ')}`);
            }
        }

        // Check message length
        if (content.length > 1000) {
            warnings.push('Message is quite long, consider shortening');
            riskScore += 5;
        }

        // Check for excessive capitalization
        const capsWords = content.match(/[A-Z]{3,}/g);
        if (capsWords && capsWords.length > 2) {
            warnings.push('Excessive use of capital letters detected');
            riskScore += 10;
        }

        // Check for excessive punctuation
        const exclamationMarks = (content.match(/!/g) || []).length;
        if (exclamationMarks > 3) {
            warnings.push('Too many exclamation marks');
            riskScore += 5;
        }

        // Check for URLs
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const urls = content.match(urlPattern);
        if (urls && urls.length > 0) {
            warnings.push('Message contains URLs - ensure they are legitimate');
            riskScore += 10;
        }

        // Check for phone numbers
        const phonePattern = /(\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g;
        const phones = content.match(phonePattern);
        if (phones && phones.length > 1) {
            warnings.push('Multiple phone numbers detected');
            riskScore += 5;
        }

        // Check for money-related content
        const moneyPattern = /(\$|₹|rupees?|dollars?|usd|inr|\d+\s*(rs|dollar|rupee))/gi;
        if (moneyPattern.test(content)) {
            warnings.push('Money-related content detected - ensure compliance');
            riskScore += 10;
        }

        return { violations, warnings, riskScore };
    }

    static async checkTemplate(templateId) {
        const violations = [];
        const warnings = [];
        let riskScore = 0;

        try {
            const template = await Template.findByPk(templateId);
            if (!template) {
                violations.push('Template not found');
                return { violations, warnings, riskScore: 100 };
            }

            // Check template category
            if (this.restrictedCategories.includes(template.category?.toLowerCase())) {
                violations.push(`Restricted template category: ${template.category}`);
                riskScore += 30;
            }

            // Check template usage frequency
            const recentUsage = await Send.count({
                where: {
                    templateId: templateId,
                    sentAt: {
                        [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            });

            if (recentUsage > 100) {
                warnings.push('Template used heavily in last 24 hours');
                riskScore += 15;
            }

            return { violations, warnings, riskScore };

        } catch (error) {
            violations.push('Error checking template compliance');
            return { violations, warnings, riskScore: 50 };
        }
    }

    static async checkRecipient(recipientPhone) {
        const violations = [];
        const warnings = [];
        let riskScore = 0;

        try {
            // Check if recipient is in DND list
            const isDnd = await DND.findOne({
                where: { phone: recipientPhone }
            });

            if (isDnd) {
                violations.push('Recipient is in Do Not Disturb (DND) list');
                riskScore += 100; // This should block the message
            }

            // Check recent message frequency to this number
            const recentMessages = await Send.count({
                where: {
                    recipientPhone: recipientPhone,
                    sentAt: {
                        [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            });

            if (recentMessages > 5) {
                warnings.push('High frequency messaging to this recipient in last 24 hours');
                riskScore += 20;
            }

            return { violations, warnings, riskScore };

        } catch (error) {
            warnings.push('Error checking recipient compliance');
            return { violations, warnings, riskScore: 10 };
        }
    }

    static calculateRiskLevel(riskScore) {
        if (riskScore >= 80) return 'high';
        if (riskScore >= 40) return 'medium';
        return 'low';
    }

    static generateRecommendations(violations, warnings, riskScore) {
        const recommendations = [];

        if (violations.length > 0) {
            recommendations.push('Fix all compliance violations before sending');
        }

        if (riskScore > 50) {
            recommendations.push('Review and modify message content to reduce spam risk');
            recommendations.push('Consider using different template or personalization');
        }

        if (warnings.some(w => w.includes('spam keywords'))) {
            recommendations.push('Remove or replace identified spam keywords');
        }

        if (warnings.some(w => w.includes('capital letters'))) {
            recommendations.push('Reduce use of capital letters for better compliance');
        }

        if (warnings.some(w => w.includes('URLs'))) {
            recommendations.push('Verify all URLs are legitimate and properly formatted');
        }

        if (riskScore < 20 && violations.length === 0) {
            recommendations.push('Message appears compliant and low risk');
        }

        return recommendations;
    }

    static async performBulkCompliance(messageData) {
        const results = {
            total: messageData.length,
            compliant: 0,
            violations: 0,
            warnings: 0,
            blocked: [],
            flagged: [],
            approved: []
        };

        for (const message of messageData) {
            const check = await this.checkMessage(
                message.content,
                message.templateId,
                message.recipientPhone
            );

            if (!check.isCompliant || check.riskLevel === 'high') {
                results.violations++;
                results.blocked.push({
                    ...message,
                    reason: check.violations.join(', ') || 'High risk content',
                    riskScore: check.riskScore
                });
            } else if (check.riskLevel === 'medium' || check.warnings.length > 0) {
                results.warnings++;
                results.flagged.push({
                    ...message,
                    warnings: check.warnings,
                    riskScore: check.riskScore
                });
            } else {
                results.compliant++;
                results.approved.push({
                    ...message,
                    riskScore: check.riskScore
                });
            }
        }

        return results;
    }

    static async generateComplianceReport(campaignId = null, dateRange = null) {
        try {
            let whereClause = {};
            
            if (campaignId) {
                whereClause.campaignId = campaignId;
            }
            
            if (dateRange) {
                whereClause.sentAt = {
                    [require('sequelize').Op.between]: [dateRange.start, dateRange.end]
                };
            } else {
                // Default to last 7 days
                whereClause.sentAt = {
                    [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                };
            }

            const sends = await Send.findAll({
                where: whereClause,
                include: [
                    { model: Template, as: 'template' },
                    { model: Campaign, as: 'campaign' }
                ]
            });

            const totalMessages = sends.length;
            const successfulSends = sends.filter(s => s.status === 'sent').length;
            const failedSends = sends.filter(s => s.status === 'failed').length;
            
            // Get DND violations
            const dndViolations = await DND.count({
                where: {
                    createdAt: {
                        [require('sequelize').Op.gte]: whereClause.sentAt[require('sequelize').Op.gte] || whereClause.sentAt[require('sequelize').Op.between][0]
                    }
                }
            });

            // Calculate compliance metrics
            const successRate = totalMessages > 0 ? (successfulSends / totalMessages * 100).toFixed(2) : 0;
            const failureRate = totalMessages > 0 ? (failedSends / totalMessages * 100).toFixed(2) : 0;

            return {
                period: dateRange || { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
                totalMessages,
                successfulSends,
                failedSends,
                successRate: `${successRate}%`,
                failureRate: `${failureRate}%`,
                dndViolations,
                complianceScore: Math.max(0, 100 - (failureRate * 2) - (dndViolations * 5)),
                recommendations: this.generateComplianceRecommendations(successRate, failureRate, dndViolations)
            };

        } catch (error) {
            console.error('Error generating compliance report:', error);
            throw error;
        }
    }

    static generateComplianceRecommendations(successRate, failureRate, dndViolations) {
        const recommendations = [];

        if (parseFloat(failureRate) > 10) {
            recommendations.push('High failure rate detected - review message content and targeting');
        }

        if (dndViolations > 0) {
            recommendations.push('DND violations found - improve audience filtering');
        }

        if (parseFloat(successRate) < 80) {
            recommendations.push('Low success rate - consider A/B testing different templates');
        }

        if (parseFloat(successRate) > 95 && dndViolations === 0) {
            recommendations.push('Excellent compliance - current practices are working well');
        }

        return recommendations;
    }
}

module.exports = ComplianceChecker;
