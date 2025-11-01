const express = require('express');
const multer = require('multer');
const router = express.Router();
const path = require('path');
const { sequelize } = require('../database');

// Import middleware
const { requireAuth } = require('../middleware/auth');
const { templateLimiter, previewLimiter, importLimiter, dndLimiter, campaignLimiter, settingsLimiter, statusLimiter } = require('../middleware/security');
const {
    templateValidation,
    previewValidation,
    paginationValidation,
    uuidValidation,
    audienceValidation,
    dndValidation,
    importValidation,
    campaignValidation,
    settingsValidation,
    handleValidationErrors,
    sanitizeInputs,
    validatePhoneNumber
} = require('../middleware/validation');

// Import models and services
const { 
    Template, 
    Audience, 
    Campaign, 
    Send, 
    DND, 
    SystemSettings,
    ComplianceRule,
    ComplianceAudit 
} = require('./models');

const {
    TemplateRenderer,
    AudienceImporter,
    CampaignScheduler,
    ThrottlingEngine,
    ComplianceChecker
} = require('./services');

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Initialize services
const campaignScheduler = new CampaignScheduler();
const throttlingEngine = new ThrottlingEngine();

// Start services
campaignScheduler.start();
throttlingEngine.initialize();

// =============== TEMPLATE ROUTES ===============

// Get all templates
router.get('/templates', paginationValidation, handleValidationErrors, async (req, res) => {
    try {
        const { category, search, page = 1, limit = 10 } = req.query;
        
        const whereClause = {};
        if (category) whereClause.category = category;
        if (search) {
            whereClause[require('sequelize').Op.or] = [
                { name: { [require('sequelize').Op.iLike]: `%${search}%` } },
                { body: { [require('sequelize').Op.iLike]: `%${search}%` } }
            ];
        }

        const templates = await Template.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            templates: templates.rows,
            pagination: {
                total: templates.count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(templates.count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Create new template
router.post('/templates', 
    requireAuth,
    templateLimiter,
    sanitizeInputs,
    templateValidation, 
    handleValidationErrors, 
    async (req, res) => {
    try {
    const { name, category, body, mediaUrl, variables, tags } = req.body;

        // Validate template content
        const compliance = await ComplianceChecker.checkMessage(body);
        if (!compliance.isCompliant) {
            return res.status(400).json({
                error: 'Template content violates compliance rules',
                violations: compliance.violations,
                recommendations: compliance.recommendations
            });
        }

        // Extract variables from template
        const extractedVariables = TemplateRenderer.extractVariables(body);

        const template = await Template.create({
            name,
            category,
            body,
            mediaUrl,
            variables: variables || extractedVariables,
            tags: tags || [],
            riskScore: compliance.riskScore,
            complianceStatus: compliance.riskLevel
        });

        res.status(201).json({ template });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Update template
router.put('/templates/:id',
    requireAuth,
    templateLimiter,
    sanitizeInputs,
    uuidValidation,
    templateValidation,
    handleValidationErrors,
    async (req, res) => {
    try {
        const { id } = req.params;
    const { name, category, body, mediaUrl, variables, tags } = req.body;

        const template = await Template.findByPk(id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Check compliance if body is being updated
        if (body && body !== template.body) {
            const compliance = await ComplianceChecker.checkMessage(body);
            if (!compliance.isCompliant) {
                return res.status(400).json({
                    error: 'Template content violates compliance rules',
                    violations: compliance.violations
                });
            }
        }

        await template.update({
            name: name || template.name,
            category: category || template.category,
            body: body || template.body,
            mediaUrl: mediaUrl !== undefined ? mediaUrl : template.mediaUrl,
            variables: variables || (body ? TemplateRenderer.extractVariables(body) : template.variables),
            tags: tags || template.tags
        });

        res.json({ template });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

// Delete template
router.delete('/templates/:id',
    requireAuth,
    templateLimiter,
    uuidValidation,
    handleValidationErrors,
    async (req, res) => {
    try {
        const { id } = req.params;
        const template = await Template.findByPk(id);
        
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Check if template is being used in any active campaigns
        const activeCampaigns = await Campaign.count({
            where: {
                templateId: id,
                status: ['scheduled', 'running', 'paused']
            }
        });

        if (activeCampaigns > 0) {
            return res.status(400).json({ 
                error: 'Template is being used in active campaigns and cannot be deleted' 
            });
        }

        await template.destroy();
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// Preview template with sample data
router.post('/templates/preview',
    previewLimiter,
    sanitizeInputs,
    previewValidation,
    handleValidationErrors,
    async (req, res) => {
    try {
        const { body, sampleData } = req.body;
        
        const preview = TemplateRenderer.render(body, sampleData || {});
        res.json({ preview });
    } catch (error) {
        console.error('Error previewing template:', error);
        res.status(500).json({ error: 'Failed to preview template' });
    }
});

// =============== AUDIENCE ROUTES ===============

// Get all audiences
router.get('/audiences', paginationValidation, handleValidationErrors, async (req, res) => {
    try {
        const { audienceId, consentStatus, search, page = 1, limit = 10 } = req.query;
        const { Op } = require('sequelize');
        
        const whereClause = {};
        // Filter out deleted records (soft delete)
        whereClause.isDeleted = { [Op.or]: [false, null] };
        if (consentStatus) whereClause.consentStatus = consentStatus;
        if (search) {
            // Sanitize search input to prevent injection
            const sanitizedSearch = search.replace(/[%_]/g, '\\$&');
            whereClause[Op.or] = [
                { name: { [Op.iLike]: `%${sanitizedSearch}%` } },
                { phone: { [Op.iLike]: `%${sanitizedSearch}%` } }
            ];
        }

        const audiences = await Audience.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            order: [['createdAt', 'DESC']]
        });

        console.log(`Audiences query result: ${audiences.count} total, ${audiences.rows.length} returned`);
        console.log('First audience:', audiences.rows[0] ? {
            id: audiences.rows[0].id,
            phone: audiences.rows[0].phone,
            name: audiences.rows[0].name,
            isDeleted: audiences.rows[0].isDeleted
        } : 'none');

        res.json({
            audiences: audiences.rows,
            pagination: {
                total: audiences.count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(audiences.count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching audiences:', error);
        res.status(500).json({ error: 'Failed to fetch audiences' });
    }
});

// Import audience from CSV
router.post('/audiences/import-csv', 
    requireAuth,
    importLimiter,
    upload.single('file'), 
    async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'CSV file is required' });
        }
        
        // Validate file size
        if (req.file.size > 5 * 1024 * 1024) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }

        const { audienceId, columnMapping } = req.body;
        
        if (!audienceId || !columnMapping) {
            if (req.file && req.file.path) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'audienceId and columnMapping are required' });
        }

        const fs = require('fs');
        
        try {
            const csvData = fs.readFileSync(req.file.path, 'utf8');
            
            // Check row count limit
            const lineCount = csvData.split('\n').length - 1; // Subtract header
            if (lineCount > 10000) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ 
                    error: 'Too many rows. Maximum 10,000 records per import.' 
                });
            }
            
            // Parse CSV data
            const parsedData = await AudienceImporter.parseCSV(csvData);
        
            // Get DND list for filtering
            const dndList = await DND.findAll({ attributes: ['phone'] })
                .then(dnds => dnds.map(d => d.phone));

            // Process import
            const results = await AudienceImporter.processImport(
                parsedData, 
                JSON.parse(columnMapping), 
                dndList
            );

            // Save valid records to database with duplicate handling
            const validRecords = results.processed.filter(r => r.errors.length === 0);
            let importedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            
            for (const record of validRecords) {
                try {
                    // Try to find existing record
                    const existingRecord = await Audience.findOne({
                        where: { phone: record.phone }
                    });

                    if (existingRecord) {
                        // Update existing record with new data
                        await existingRecord.update({
                            name: record.name,
                            customFields: record.customFields,
                            tags: record.tags,
                            consentStatus: record.consentStatus,
                            importedAt: new Date()
                        });
                        updatedCount++;
                    } else {
                        // Create new record
                        await Audience.create({
                            phone: record.phone,
                            name: record.name,
                            customFields: record.customFields,
                            tags: record.tags,
                            consentStatus: record.consentStatus,
                            importedAt: new Date()
                        });
                        importedCount++;
                    }
                } catch (error) {
                    console.error(`Error processing record ${record.phone}:`, error);
                    skippedCount++;
                }
            }

            // Generate summary
            const summary = AudienceImporter.generateImportSummary(results);
            summary.importedCount = importedCount;
            summary.updatedCount = updatedCount;
            summary.skippedCount = skippedCount;

            res.json({ 
                message: 'Import completed',
                summary,
                imported: importedCount,
                updated: updatedCount,
                skipped: skippedCount
            });
        } finally {
            // Always clean up uploaded file
            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        }
    } catch (error) {
        console.error('Error importing CSV:', error);
        // Clean up file on error
        if (req.file && req.file.path && require('fs').existsSync(req.file.path)) {
            require('fs').unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to import CSV' });
    }
});

// Import audience from paste data
router.post('/audiences/import-paste',
    requireAuth,
    importLimiter,
    sanitizeInputs,
    importValidation,
    handleValidationErrors,
    async (req, res) => {
    try {
        const { audienceId, pasteData, columnMapping } = req.body;
        
        // Parse paste data
        const parsedData = AudienceImporter.parsePasteData(pasteData);
        
        if (parsedData.length === 0) {
            return res.status(400).json({ error: 'No valid data found in paste input' });
        }
        
        // Check row limit
        if (parsedData.length > 10000) {
            return res.status(400).json({ 
                error: 'Too many rows. Maximum 10,000 records per import.' 
            });
        }

        // Get DND list for filtering
        const dndList = await DND.findAll({ attributes: ['phone'] })
            .then(dnds => dnds.map(d => d.phone));

        // Process import
        const results = await AudienceImporter.processImport(parsedData, columnMapping, dndList);

        // Save valid records to database with duplicate handling
        const validRecords = results.processed.filter(r => r.errors.length === 0);
        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const record of validRecords) {
            try {
                // Try to find existing record
                const existingRecord = await Audience.findOne({
                    where: { phone: record.phone }
                });

                if (existingRecord) {
                    // Update existing record with new data
                    await existingRecord.update({
                        name: record.name,
                        customFields: record.customFields,
                        tags: record.tags,
                        consentStatus: record.consentStatus,
                        importedAt: new Date()
                    });
                    updatedCount++;
                } else {
                    // Create new record
                    await Audience.create({
                        phone: record.phone,
                        name: record.name,
                        customFields: record.customFields,
                        tags: record.tags,
                        consentStatus: record.consentStatus,
                        importedAt: new Date()
                    });
                    importedCount++;
                }
            } catch (error) {
                console.error(`Error processing record ${record.phone}:`, error);
                skippedCount++;
            }
        }

        // Generate summary
        const summary = AudienceImporter.generateImportSummary(results);
        summary.importedCount = importedCount;
        summary.updatedCount = updatedCount;
        summary.skippedCount = skippedCount;

        res.json({ 
            message: 'Import completed',
            summary,
            imported: importedCount,
            updated: updatedCount,
            skipped: skippedCount
        });

    } catch (error) {
        console.error('Error importing paste data:', error);
        res.status(500).json({ error: 'Failed to import paste data' });
    }
});

// Add to DND list
router.post('/audiences/dnd',
    requireAuth,
    dndLimiter,
    sanitizeInputs,
    dndValidation,
    handleValidationErrors,
    async (req, res) => {
    try {
        let { phone, reason } = req.body;
        
        // Normalize phone number
        const phoneValidation = validatePhoneNumber(phone);
        if (!phoneValidation.valid) {
            return res.status(400).json({ error: phoneValidation.error });
        }
        phone = phoneValidation.normalized;

        const existingDnd = await DND.findOne({ where: { phone } });
        if (existingDnd) {
            return res.status(400).json({ error: 'Phone number already in DND list' });
        }

        const dnd = await DND.create({ phone, reason });
        res.status(201).json({ dnd });
    } catch (error) {
        console.error('Error adding to DND:', error);
        res.status(500).json({ error: 'Failed to add to DND list' });
    }
});

// Remove from DND list
router.delete('/audiences/dnd/:phone',
    requireAuth,
    dndLimiter,
    async (req, res) => {
    try {
        let { phone } = req.params;
        
        // Normalize phone number for lookup
        const phoneValidation = validatePhoneNumber(phone);
        if (phoneValidation.valid) {
            phone = phoneValidation.normalized;
        }
        
        const dnd = await DND.findOne({ where: { phone } });
        
        if (!dnd) {
            return res.status(404).json({ error: 'Phone number not found in DND list' });
        }

        await dnd.destroy();
        res.json({ message: 'Removed from DND list successfully' });
    } catch (error) {
        console.error('Error removing from DND:', error);
        res.status(500).json({ error: 'Failed to remove from DND list' });
    }
});

// Delete audience contact
router.delete('/audiences/:id',
    requireAuth,
    dndLimiter,
    uuidValidation,
    handleValidationErrors,
    async (req, res) => {
    try {
        const { id } = req.params;
    const force = (req.query.force === 'true');

        // Try by primary key (UUID)
        let contact = await Audience.findByPk(id);

        // Fallback: allow deletion by phone number if UUID not found
        if (!contact && /^[0-9+]{5,}$/.test(id)) {
            contact = await Audience.findOne({ where: { phone: id } });
        }

        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        const { Send } = require('./models');
        let sendCount = await Send.count({ where: { audienceId: contact.id } });

        if (sendCount > 0 && force) {
            // Force cascade: delete all related sends first
            await sequelize.transaction(async (t) => {
                await Send.destroy({ where: { audienceId: contact.id }, transaction: t });
                await contact.destroy({ transaction: t });
            });
            return res.json({ message: 'Contact and related sends deleted (force)', deleted: true, cascadedSends: sendCount });
        }

        if (sendCount > 0 && !force) {
            // Soft delete (anonymize) to keep history intact
            await contact.update({
                phone: `deleted:${contact.phone}:${Date.now()}`.slice(0, 50),
                name: 'Deleted Contact',
                tags: ['deleted'],
        consentStatus: 'opted_out',
        isDeleted: true
            });
            return res.json({ message: 'Contact had message history; anonymized instead of deletion', anonymized: true, sendCount });
        }

        // No sends referencing; safe to hard delete
    await contact.update({ isDeleted: true });
    return res.json({ message: 'Contact deleted successfully', deleted: true, sendCount: 0 });
    } catch (error) {
        console.error('Error deleting contact:', error);
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(409).json({ error: 'Contact is referenced by other records; retry with ?force=true to cascade delete sends' });
        }
        return res.status(500).json({ error: 'Failed to delete contact', details: error.message });
    }
});

// =============== CAMPAIGN ROUTES ===============

// Get all campaigns
router.get('/campaigns', requireAuth, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        
        const whereClause = {};
        if (status) whereClause.status = status;

        const campaigns = await Campaign.findAndCountAll({
            where: whereClause,
            include: [
                { model: Template, as: 'template', attributes: ['name', 'category'] }
            ],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            campaigns: campaigns.rows,
            pagination: {
                total: campaigns.count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(campaigns.count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

// Create new campaign
router.post('/campaigns', requireAuth, campaignLimiter, campaignValidation, handleValidationErrors, async (req, res) => {
    try {
        const {
            name,
            templateId,
            audienceId,
            scheduledTime,
            rateLimit,
            description
        } = req.body;

        // Validate required fields
        if (!name || !templateId || !audienceId) {
            return res.status(400).json({ error: 'Name, template, and audience are required' });
        }

        // Validate template exists
        const template = await Template.findByPk(templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // For now, handle audience segments as simple identifiers
        // In a real implementation, you'd have a separate AudienceSegments table
        let audienceSize = 0;
        let whereClause = {};

        switch (audienceId) {
            case 'main_list':
                whereClause = { consentStatus: 'opted_in' };
                break;
            case 'all_contacts':
                // Include everyone regardless of consent (use cautiously)
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
                // If it's a UUID, treat it as a specific audience segment (future feature)
                whereClause = { consentStatus: 'opted_in' };
        }

        // Count audience size
        console.log('Campaign creation - audienceId:', audienceId);
        console.log('Campaign creation - whereClause:', JSON.stringify(whereClause, null, 2));
        
        // First, let's verify the Audience table structure
        try {
            const testQuery = await sequelize.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'Audiences'",
                { type: sequelize.QueryTypes.SELECT }
            );
            console.log('Campaign creation - Audience table columns:', testQuery.map(col => col.column_name));
        } catch (error) {
            console.error('Campaign creation - Error checking table structure:', error.message);
        }
        
        try {
            // Add soft delete filter
            audienceSize = await Audience.count({ where: { ...whereClause, isDeleted: false } });
            console.log('Campaign creation - audienceSize:', audienceSize);
        } catch (error) {
            console.error('Campaign creation - Audience count error:', error.message);
            console.error('Campaign creation - Full error:', error);
            return res.status(500).json({ 
                error: 'Failed to count audience members'
            });
        }

        if (audienceSize === 0) {
            return res.status(400).json({ error: 'No valid audience members found for this segment' });
        }

        const campaign = await Campaign.create({
            name,
            templateId,
            segmentFilter: { audienceId }, // Store the segment identifier in segmentFilter
            scheduledAt: scheduledTime ? new Date(scheduledTime) : null,
            status: scheduledTime ? 'scheduled' : 'draft',
            rateLimit: {
                msgsPerMinute: rateLimit || 10,
                batchSize: 25,
                batchRestMs: 90000,
                jitterMsMin: 800,
                jitterMsMax: 3000,
                dailyCap: 300
            },
            totalRecipients: audienceSize,
            createdBy: req.user ? req.user.id : 'system' // Use authenticated user ID
        });

        res.status(201).json({ campaign });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// Update campaign
router.put('/campaigns/:id', requireAuth, uuidValidation, handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;

        const campaign = await Campaign.findByPk(id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Authorization check - verify user owns the campaign
        if (req.user && campaign.createdBy && campaign.createdBy !== req.user.id && campaign.createdBy !== 'system') {
            return res.status(403).json({ error: 'Not authorized to modify this campaign' });
        }

        // Don't allow updates to running campaigns
        if (['running', 'completed'].includes(campaign.status)) {
            return res.status(400).json({ 
                error: 'Cannot update running or completed campaigns' 
            });
        }

        // Whitelist allowed update fields
        const allowedFields = ['name', 'description', 'scheduledAt', 'status'];
        const updateData = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        await campaign.update(updateData);
        res.json({ campaign });
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});

// Start campaign
router.post('/campaigns/:id/start', requireAuth, uuidValidation, handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Use transaction to prevent race conditions
        const result = await sequelize.transaction(async (t) => {
            const campaign = await Campaign.findByPk(id, {
                include: [{ model: Template, as: 'template' }],
                lock: true,
                transaction: t
            });

            if (!campaign) {
                throw new Error('Campaign not found');
            }

            if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
                throw new Error('Campaign cannot be started');
            }

            // Start the campaign through scheduler
            await campaignScheduler.startCampaign(campaign);
            
            return campaign;
        });

        res.json({ message: 'Campaign started successfully' });
    } catch (error) {
        console.error('Error starting campaign:', error);
        if (error.message === 'Campaign not found') {
            return res.status(404).json({ error: error.message });
        }
        if (error.message === 'Campaign cannot be started') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to start campaign' });
    }
});

// Pause campaign
router.post('/campaigns/:id/pause', requireAuth, uuidValidation, handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const success = await campaignScheduler.pauseCampaign(id);

        if (!success) {
            return res.status(400).json({ error: 'Failed to pause campaign' });
        }

        res.json({ message: 'Campaign paused successfully' });
    } catch (error) {
        console.error('Error pausing campaign:', error);
        res.status(500).json({ error: 'Failed to pause campaign' });
    }
});

// Resume campaign
router.post('/campaigns/:id/resume', requireAuth, uuidValidation, handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const success = await campaignScheduler.resumeCampaign(id);

        if (!success) {
            return res.status(400).json({ error: 'Failed to resume campaign' });
        }

        res.json({ message: 'Campaign resumed successfully' });
    } catch (error) {
        console.error('Error resuming campaign:', error);
        res.status(500).json({ error: 'Failed to resume campaign' });
    }
});

// Stop campaign
router.post('/campaigns/:id/stop', requireAuth, uuidValidation, handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const success = await campaignScheduler.stopCampaign(id);

        if (!success) {
            return res.status(400).json({ error: 'Failed to stop campaign' });
        }

        res.json({ message: 'Campaign stopped successfully' });
    } catch (error) {
        console.error('Error stopping campaign:', error);
        res.status(500).json({ error: 'Failed to stop campaign' });
    }
});

// Get campaign statistics
router.get('/campaigns/:id/stats', requireAuth, uuidValidation, handleValidationErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const campaign = await Campaign.findByPk(id, {
            include: [
                { model: Template, as: 'template' }
            ]
        });

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Get detailed send statistics
        const sendStats = await Send.findAll({
            where: { campaignId: id },
            attributes: [
                'status',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        const stats = {
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                createdAt: campaign.createdAt,
                startedAt: campaign.startedAt,
                completedAt: campaign.completedAt
            },
            sends: sendStats.reduce((acc, stat) => {
                acc[stat.status] = parseInt(stat.count);
                return acc;
            }, {}),
            scheduler: campaignScheduler.getCampaignStatus(id)
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching campaign stats:', error);
        res.status(500).json({ error: 'Failed to fetch campaign statistics' });
    }
});

// =============== SYSTEM SETTINGS ROUTES ===============

// Get system settings
router.get('/settings', requireAuth, settingsLimiter, async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();
        if (!settings) {
            // Create default settings
            settings = await SystemSettings.create({
                messagesPerMinute: 10,
                messagesPerHour: 300,
                messagesPerDay: 1000,
                warmupMode: false,
                warmupLimit: 50
            });
        }

        res.json({ settings });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update system settings
router.put('/settings', requireAuth, settingsLimiter, settingsValidation, handleValidationErrors, async (req, res) => {
    try {
        const updateData = req.body;
        
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create(updateData);
        } else {
            await settings.update(updateData);
        }

        res.json({ settings });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// =============== MONITORING ROUTES ===============

// Get system status
router.get('/status', requireAuth, statusLimiter, async (req, res) => {
    try {
        const activeCampaigns = campaignScheduler.getAllActiveCampaigns();
        const throttlingStatus = throttlingEngine.getStatus();
        const banRisk = await throttlingEngine.getBanRiskAssessment();

        res.json({
            activeCampaigns,
            throttling: throttlingStatus,
            banRisk,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch system status' });
    }
});

// Get compliance report
router.get('/compliance/report', requireAuth, async (req, res) => {
    try {
        const { campaignId, startDate, endDate } = req.query;
        
        const dateRange = startDate && endDate ? {
            start: new Date(startDate),
            end: new Date(endDate)
        } : null;

        const report = await ComplianceChecker.generateComplianceReport(
            campaignId, 
            dateRange
        );

        res.json({ report });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate compliance report' });
    }
});

// Check message compliance
router.post('/compliance/check', requireAuth, async (req, res) => {
    try {
        const { messageContent, templateId, recipientPhone } = req.body;
        
        const compliance = await ComplianceChecker.checkMessage(
            messageContent,
            templateId,
            recipientPhone
        );

        res.json({ compliance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check compliance' });
    }
});

// ================= Added Compliance Center & DND endpoints =================

// Compliance status overview (for compliance-center.html)
router.get('/compliance/status', requireAuth, async (req, res) => {
    try {
        const [audienceCount, optedIn, dndCount, last7Sends] = await Promise.all([
            Audience.count(),
            Audience.count({ where: { consentStatus: 'opted_in' } }),
            DND.count(),
            Send.findAll({
                where: { sentAt: { [require('sequelize').Op.gte]: new Date(Date.now() - 7*24*60*60*1000) } },
                attributes: ['status']
            })
        ]);

        const totalSends = last7Sends.length;
        const failed = last7Sends.filter(s => s.status === 'failed').length;
        const sent = last7Sends.filter(s => s.status === 'sent').length;

        const optInRate = audienceCount ? (optedIn / audienceCount * 100) : 0;
        const blockRate = totalSends ? (failed / totalSends * 100) : 0;
        const responseRate = sent ? Math.min(100, (sent / audienceCount) * 100) : 0; // heuristic placeholder
        const dndPercentage = audienceCount ? (dndCount / audienceCount * 100) : 0;

        const rules = await ComplianceRule.findAll({ where: { enabled: true } });
        const violations = rules.filter(r => r.violations > 0).map(r => ({
            rule: r.name,
            description: r.description,
            severity: r.severity,
            count: r.violations
        }));

        const score = Math.max(0, Math.round(100 - (blockRate * 0.8) - (dndPercentage * 0.5) - (violations.length * 2)));

        res.json({
            score,
            metrics: { optInRate, responseRate, blockRate, dndPercentage },
            violations
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get compliance status' });
    }
});

// Compliance rules
router.get('/compliance/rules', requireAuth, async (req, res) => {
    const rules = await ComplianceRule.findAll({ order: [['createdAt','DESC']] });
    res.json(rules);
});

router.post('/compliance/rules', requireAuth, async (req, res) => {
    try {
        const rule = await ComplianceRule.create(req.body);
        await ComplianceAudit.create({ action: 'rule_created', description: `Rule ${rule.name} created`, severity: 'info' });
        res.status(201).json(rule);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create rule' });
    }
});

router.post('/compliance/rules/:id/toggle', requireAuth, async (req, res) => {
    try {
        const rule = await ComplianceRule.findByPk(req.params.id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        rule.enabled = !rule.enabled;
        await rule.save();
        await ComplianceAudit.create({ action: 'rule_toggled', description: `Rule ${rule.name} ${rule.enabled ? 'enabled' : 'disabled'}`, severity: 'info' });
        res.json(rule);
    } catch (e) {
        res.status(500).json({ error: 'Failed to toggle rule' });
    }
});

router.delete('/compliance/rules/:id', requireAuth, async (req, res) => {
    try {
        const rule = await ComplianceRule.findByPk(req.params.id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        await rule.destroy();
        await ComplianceAudit.create({ action: 'rule_deleted', description: `Rule ${rule.name} deleted`, severity: 'low' });
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete rule' });
    }
});

// Audit trail
router.get('/compliance/audit', requireAuth, async (req, res) => {
    const limit = parseInt(req.query.limit || '20');
    const audit = await ComplianceAudit.findAll({ order: [['createdAt','DESC']], limit });
    res.json(audit.map(a => ({ id: a.id, action: a.action, description: a.description, severity: a.severity, timestamp: a.createdAt })));
});

// DND expected endpoints for compliance center UI
router.get('/dnd', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1');
        const limit = parseInt(req.query.limit || '10');
        const offset = (page - 1) * limit;
        const { rows, count } = await DND.findAndCountAll({ order: [['addedAt','DESC']], limit, offset });
        res.json({
            dndList: rows.map(r => ({ phoneNumber: r.phone, addedAt: r.addedAt, reason: r.reason })),
            total: count,
            page,
            pages: Math.ceil(count / limit)
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch DND list' });
    }
});

router.post('/dnd', async (req, res) => {
    try {
        const { phoneNumber, reason } = req.body;
        if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });
        const existing = await DND.findOne({ where: { phone: phoneNumber } });
        if (existing) return res.status(200).json({ message: 'Already present' });
        const entry = await DND.create({ phone: phoneNumber, reason });
        res.status(201).json({ entry });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add to DND' });
    }
});

router.delete('/dnd/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        const entry = await DND.findOne({ where: { phone } });
        if (!entry) return res.status(404).json({ error: 'Not found' });
        await entry.destroy();
        res.json({ message: 'Removed' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove from DND' });
    }
});

router.post('/dnd/bulk', async (req, res) => {
    try {
        const { numbers = [], reason } = req.body;
        let added = 0, skipped = 0;
        for (const num of numbers) {
            const existing = await DND.findOne({ where: { phone: num } });
            if (existing) { skipped++; continue; }
            await DND.create({ phone: num, reason });
            added++;
        }
        res.json({ added, skipped });
    } catch (e) {
        res.status(500).json({ error: 'Failed bulk add' });
    }
});

router.post('/dnd/import', require('multer')({ dest: 'uploads/' }).single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'file required' });
        const fs = require('fs');
        const data = fs.readFileSync(req.file.path, 'utf8');
        const lines = data.split(/\r?\n/).filter(l => l.trim());
        let added = 0, skipped = 0;
        for (const line of lines) {
            const [phone, reason] = line.split(',').map(s => s.trim());
            if (!phone) continue;
            const exists = await DND.findOne({ where: { phone } });
            if (exists) { skipped++; continue; }
            await DND.create({ phone, reason });
            added++;
        }
        res.json({ imported: added, skipped });
    } catch (e) {
        res.status(500).json({ error: 'Failed to import CSV' });
    }
});

router.get('/dnd/export', async (req, res) => {
    try {
        const list = await DND.findAll({ order: [['addedAt','DESC']] });
        const csv = 'phone,reason\n' + list.map(l => `${l.phone},${l.reason||''}`).join('\n');
        res.setHeader('Content-Type','text/csv');
        res.setHeader('Content-Disposition','attachment; filename="dnd-export.csv"');
        res.send(csv);
    } catch (e) {
        res.status(500).json({ error: 'Failed to export' });
    }
});

module.exports = router;
