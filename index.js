const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Database imports
const { sequelize, testConnection } = require('./database');
const { Message, Contact, Group, Chat, WebhookLog, ApiKey, WhatsAppAccount, ApiLog } = require('./models');

// External API imports
const externalApiRoutes = require('./routes/externalApi');
const apiKeysRoutes = require('./routes/apiKeys');
const accountManagerRoutes = require('./routes/accountManager');
const multiAccountApiRoutes = require('./routes/multiAccountApi');
const webhookService = require('./services/webhookService');

// Multi-account support
const phoneSessionManager = require('./services/phoneSessionManager');

// Security middleware imports
const { securityHeaders, apiLimiter } = require('./middleware/security');
const { apiLoggerMiddleware } = require('./middleware/apiLogger');

const app = express();

// Apply security headers first
app.use(securityHeaders);

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

app.use(express.static('public'));
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' })); // Add size limit
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Apply API logging middleware to API routes
app.use('/api/v2', apiLoggerMiddleware);
app.use('/api/external', apiLoggerMiddleware);

// Add API routes
app.use('/api/external', externalApiRoutes);
app.use('/api/keys', apiKeysRoutes);
app.use('/api/accounts', accountManagerRoutes);
app.use('/api/v2', multiAccountApiRoutes); // New multi-account API

// ============================================
// LEGACY CLIENT REMOVED
// All WhatsApp functionality now uses multi-account API
// Use /api/v2/* endpoints with phone-id and token headers
// ============================================

global.whatsappReady = false; // Keep for backward compatibility

// Enhanced error handling with logging
const { logger } = require('./utils/logger');

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    // Log to database or external monitoring service
    console.error('❌ UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    console.error('❌ UNCAUGHT EXCEPTION:', error);
    
    // Attempt graceful shutdown
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    gracefulShutdown('SIGINT');
});

// Graceful shutdown handler
async function gracefulShutdown(signal) {
    console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
    
    try {
        // Close all WhatsApp multi-account sessions
        console.log('📱 Closing WhatsApp sessions...');
        const sessions = phoneSessionManager.getAllSessions();
        for (const session of sessions) {
            try {
                await phoneSessionManager.removeSession(session.phone_id);
            } catch (err) {
                console.error(`Error closing session ${session.phone_id}:`, err);
            }
        }
        
        // Close database connections
        console.log('💾 Closing database connections...');
        await sequelize.close();
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
}

// ============================================
// ROUTES - Multi-Account API Only
// ============================================
// All legacy endpoints have been removed
// Use /api/v2/* endpoints with phone-id and token headers
// ============================================

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await sequelize.authenticate();
        const dbStatus = 'connected';
        
        // Get session information
        const allSessions = phoneSessionManager.getAllSessions();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                unit: 'MB'
            },
            database: dbStatus,
            multi_account: {
                total_sessions: allSessions.length,
                connected: allSessions.filter(s => s.status === 'connected').length
            }
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Health check endpoint alias (for frontend compatibility)
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        await sequelize.authenticate();
        const dbStatus = 'connected';
        
        // Get session information
        const allSessions = phoneSessionManager.getAllSessions();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                unit: 'MB'
            },
            database: dbStatus,
            multi_account: {
                total_sessions: allSessions.length,
                connected: allSessions.filter(s => s.status === 'connected').length
            }
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Get system status
app.get('/status', async (req, res) => {
    try {
        // Multi-account status
        const allSessions = phoneSessionManager.getAllSessions();
        const multiAccountStatus = {
            total_accounts: allSessions.length,
            connected_accounts: allSessions.filter(s => s.status === 'connected').length,
            pending_accounts: allSessions.filter(s => s.status === 'pending').length,
            accounts: allSessions
        };

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            multi_account: multiAccountStatus,
            api_endpoints: ['/api/v2/send-message', '/api/v2/send-media', '/api/v2/send-file-by-url', '/api/v2/create-group'],
            account_management: ['/api/accounts/create', '/api/accounts/{phone_id}/qr', '/api/accounts/{phone_id}/status']
        });
    } catch (error) {
        console.error('❌ Error getting status:', error);
        res.status(500).json({
            error: 'Failed to get status',
            message: error.message
        });
    }
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
    res.json({
        name: 'WhatsApp Multi-Account API',
        version: '2.0.0',
        description: 'WhatsApp automation with multiple account support',
        endpoints: {
            account_management: {
                create_account: {
                    method: 'POST',
                    path: '/api/accounts/create',
                    body: {
                        phone_id: 'string (required)',
                        name: 'string (optional)',
                        webhook_url: 'string (optional)',
                        webhook_events: 'array (optional)'
                    }
                },
                get_qr: {
                    method: 'GET',
                    path: '/api/accounts/{phone_id}/qr'
                },
                get_status: {
                    method: 'GET',
                    path: '/api/accounts/{phone_id}/status'
                }
            },
            messaging: {
                send_message: {
                    method: 'POST',
                    path: '/api/v2/send-message',
                    headers: {
                        'phone-id': 'string (required)',
                        'token': 'string (required)'
                    },
                    body: {
                        to: 'string (phone number)',
                        message: 'string'
                    }
                },
                send_media: {
                    method: 'POST',
                    path: '/api/v2/send-media',
                    headers: {
                        'phone-id': 'string (required)',
                        'token': 'string (required)'
                    },
                    body: 'multipart/form-data'
                },
                send_file_by_url: {
                    method: 'POST',
                    path: '/api/v2/send-file-by-url',
                    headers: {
                        'phone-id': 'string (required)',
                        'token': 'string (required)'
                    },
                    body: {
                        to: 'string (phone number)',
                        url: 'string (file URL)',
                        caption: 'string (optional)'
                    }
                }
            },
            groups: {
                create_group: {
                    method: 'POST',
                    path: '/api/v2/create-group',
                    headers: {
                        'phone-id': 'string (required)',
                        'token': 'string (required)'
                    },
                    body: {
                        name: 'string',
                        participants: 'array of phone numbers'
                    }
                },
                get_groups: {
                    method: 'GET',
                    path: '/api/v2/groups',
                    headers: {
                        'phone-id': 'string (required)',
                        'token': 'string (required)'
                    }
                }
            }
        }
    });
});

// --- DATABASE ENDPOINTS ---
app.get('/database/messages', async (req, res) => {
    try {
        const { limit = 50, offset = 0, chatId } = req.query;
        const where = chatId ? { to: chatId } : {};
        
        const messages = await Message.findAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['timestamp', 'DESC']]
        });
        
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/database/contacts', async (req, res) => {
    try {
        const contacts = await Contact.findAll({
            order: [['name', 'ASC']]
        });
        res.json({ contacts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/database/chats', async (req, res) => {
    try {
        const chats = await Chat.findAll({
            order: [['timestamp', 'DESC']]
        });
        res.json({ chats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/database/groups', async (req, res) => {
    try {
        const groups = await Group.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json({ groups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/database/stats', async (req, res) => {
    try {
        const stats = {
            totalMessages: await Message.count(),
            totalContacts: await Contact.count(),
            totalChats: await Chat.count(),
            totalGroups: await Group.count(),
            recentMessages: await Message.count({
                where: {
                    timestamp: {
                        [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            })
        };
        res.json({ stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Message Logs API Endpoints
app.get('/api/messages/logs', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { 
            page = 1, 
            limit = 20, 
            direction, 
            type, 
            chatType, 
            search, 
            dateFrom, 
            dateTo, 
            sort = 'desc' 
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const where = {};

        // Filter by direction (sent/received)
        if (direction === 'sent') {
            where.fromMe = true;
        } else if (direction === 'received') {
            where.fromMe = false;
        }

        // Filter by message type
        if (type) {
            where.type = type;
        }

        // Filter by chat type (individual/group)
        if (chatType === 'group') {
            where.isGroupMsg = true;
        } else if (chatType === 'individual') {
            where.isGroupMsg = false;
        }

        // Search in message body
        if (search) {
            where.body = {
                [Op.iLike]: `%${search}%`
            };
        }

        // Date range filter
        if (dateFrom || dateTo) {
            where.timestamp = {};
            if (dateFrom) {
                where.timestamp[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                where.timestamp[Op.lte] = toDate;
            }
        }

        // Get messages with pagination
        const { count, rows } = await Message.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: offset,
            order: [['timestamp', sort.toUpperCase()]],
            attributes: [
                'id', 'messageId', 'from', 'to', 'body', 'type', 
                'timestamp', 'isGroupMsg', 'author', 'quotedMsgId', 
                'mediaData', 'location', 'vCards', 'isForwarded', 
                'forwardingScore', 'isStatus', 'isStarred', 'fromMe'
            ]
        });

        const totalPages = Math.ceil(count / parseInt(limit));

        res.json({
            success: true,
            messages: rows,
            total: count,
            page: parseInt(page),
            totalPages: totalPages,
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching message logs:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Message Stats API Endpoint
app.get('/api/messages/stats', async (req, res) => {
    try {
        const total = await Message.count();
        const sent = await Message.count({ where: { fromMe: true } });
        const received = await Message.count({ where: { fromMe: false } });
        const group = await Message.count({ where: { isGroupMsg: true } });

        res.json({
            success: true,
            stats: {
                total,
                sent,
                received,
                group
            }
        });
    } catch (error) {
        console.error('Error fetching message stats:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API Request Logs Endpoint
app.get('/api/logs/requests', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { 
            page = 1, 
            limit = 20, 
            phone_id,
            endpoint,
            method,
            success,
            status_code,
            dateFrom, 
            dateTo,
            ip_address,
            search,
            sort = 'desc' 
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const where = {};

        // Filter by phone_id
        if (phone_id) {
            where.phone_id = phone_id;
        }

        // Filter by endpoint
        if (endpoint) {
            where.endpoint = {
                [Op.iLike]: `%${endpoint}%`
            };
        }

        // Filter by HTTP method
        if (method) {
            where.method = method;
        }

        // Filter by success status
        if (success !== undefined) {
            where.success = success === 'true' || success === true;
        }

        // Filter by status code
        if (status_code) {
            where.status_code = parseInt(status_code);
        }

        // Filter by IP address
        if (ip_address) {
            where.ip_address = {
                [Op.iLike]: `%${ip_address}%`
            };
        }

        // Search in request/response body or error message
        if (search) {
            where[Op.or] = [
                sequelize.literal(`"request_body"::text ILIKE '%${search}%'`),
                sequelize.literal(`"response_body"::text ILIKE '%${search}%'`),
                { error_message: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Date range filter
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                where.createdAt[Op.lte] = toDate;
            }
        }

        // Get logs with pagination
        const { count, rows } = await ApiLog.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: offset,
            order: [['createdAt', sort.toUpperCase()]],
            attributes: [
                'id', 'phone_id', 'endpoint', 'method', 'request_body', 
                'response_body', 'status_code', 'success', 'error_message', 
                'ip_address', 'user_agent', 'response_time', 'message_id', 'createdAt'
            ]
        });

        const totalPages = Math.ceil(count / parseInt(limit));

        res.json({
            success: true,
            logs: rows,
            total: count,
            page: parseInt(page),
            totalPages: totalPages,
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching API logs:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API Logs Stats Endpoint
app.get('/api/logs/stats', async (req, res) => {
    try {
        const { dateFrom, dateTo, phone_id } = req.query;
        const { Op } = require('sequelize');
        
        const where = {};
        
        // Filter by phone_id
        if (phone_id) {
            where.phone_id = phone_id;
        }
        
        // Date range filter
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                where.createdAt[Op.lte] = toDate;
            }
        }
        
        const total = await ApiLog.count({ where });
        const successful = await ApiLog.count({ where: { ...where, success: true } });
        const failed = await ApiLog.count({ where: { ...where, success: false } });
        
        // Get average response time
        const avgResponseTime = await ApiLog.findOne({
            where,
            attributes: [
                [sequelize.fn('AVG', sequelize.col('response_time')), 'avg_time']
            ],
            raw: true
        });
        
        // Get endpoint breakdown
        const endpointStats = await ApiLog.findAll({
            where,
            attributes: [
                'endpoint',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['endpoint'],
            order: [[sequelize.literal('count'), 'DESC']],
            limit: 10,
            raw: true
        });
        
        // Get method breakdown
        const methodStats = await ApiLog.findAll({
            where,
            attributes: [
                'method',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['method'],
            raw: true
        });

        res.json({
            success: true,
            stats: {
                total,
                successful,
                failed,
                successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
                averageResponseTime: avgResponseTime?.avg_time ? Math.round(avgResponseTime.avg_time) : 0,
                endpointStats,
                methodStats
            }
        });
    } catch (error) {
        console.error('Error fetching API stats:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});


// Export Messages to CSV
app.get('/api/messages/export', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { 
            direction, 
            type, 
            chatType, 
            search, 
            dateFrom, 
            dateTo 
        } = req.query;

        const where = {};

        // Apply same filters as logs endpoint
        if (direction === 'sent') {
            where.fromMe = true;
        } else if (direction === 'received') {
            where.fromMe = false;
        }

        if (type) {
            where.type = type;
        }

        if (chatType === 'group') {
            where.isGroupMsg = true;
        } else if (chatType === 'individual') {
            where.isGroupMsg = false;
        }

        if (search) {
            where.body = {
                [Op.iLike]: `%${search}%`
            };
        }

        if (dateFrom || dateTo) {
            where.timestamp = {};
            if (dateFrom) {
                where.timestamp[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                where.timestamp[Op.lte] = toDate;
            }
        }

        const messages = await Message.findAll({
            where,
            order: [['timestamp', 'DESC']],
            limit: 10000 // Limit export to 10k messages
        });

        // Generate CSV
        let csv = 'Timestamp,Direction,Type,From,To,Body,Group,Author,Forwarded,Starred\n';
        
        messages.forEach(msg => {
            const timestamp = new Date(msg.timestamp).toISOString();
            const direction = msg.fromMe ? 'Sent' : 'Received';
            const body = (msg.body || '').replace(/"/g, '""').replace(/\n/g, ' ');
            const from = msg.from.replace('@c.us', '').replace('@g.us', '');
            const to = msg.to.replace('@c.us', '').replace('@g.us', '');
            const author = msg.author ? msg.author.replace('@c.us', '').replace('@g.us', '') : '';
            
            csv += `"${timestamp}","${direction}","${msg.type}","${from}","${to}","${body}","${msg.isGroupMsg}","${author}","${msg.isForwarded}","${msg.isStarred}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=message-logs-${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting messages:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Start server with database initialization
const startServer = async () => {
    try {
        // Test database connection
        await testConnection();
        
        // Sync database tables
        await sequelize.sync({ force: false });
        console.log('✅ Database tables synchronized');
        
        // Initialize webhook service
        await webhookService.initialize();
        console.log('✅ Webhook service initialized');
        
        // Initialize multi-account phone session manager
        console.log('🔄 Initializing multi-account phone session manager...');
        await phoneSessionManager.initialize();
        console.log('✅ Multi-account phone session manager initialized');
        
        // Start Express server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌐 Web interface: http://localhost:${PORT}`);
            console.log(`📱 Account Management: http://localhost:${PORT}/account.html`);
            console.log(`📚 API Docs & Tester: http://localhost:${PORT}/api-documentation.html`);
            console.log(`💾 Database: PostgreSQL connected`);
            console.log('');
            console.log('📋 API Endpoints:');
            console.log('   📊 Account Management: /api/accounts/*');
            console.log('   📤 Multi-Account API: /api/v2/*');
            console.log('');
            console.log('🎯 Multi-Account Usage:');
            console.log('   1. Create account: POST /api/accounts/create');
            console.log('   2. Get QR code: GET /api/accounts/{phone_id}/qr');
            console.log('   3. Use API with headers: phone-id, token');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
