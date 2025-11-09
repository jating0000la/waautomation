const { ApiLog } = require('../models');

/**
 * Middleware to log API requests and responses
 * Captures request details, response data, and performance metrics
 */
function apiLoggerMiddleware(req, res, next) {
    // Start time for response time calculation
    const startTime = Date.now();
    
    // Store original res.json to intercept response
    const originalJson = res.json;
    const originalSend = res.send;
    
    let responseBody = null;
    let statusCode = 200;
    
    // Intercept res.json
    res.json = function(data) {
        responseBody = data;
        statusCode = res.statusCode || 200;
        return originalJson.call(this, data);
    };
    
    // Intercept res.send
    res.send = function(data) {
        if (!responseBody) {
            responseBody = data;
        }
        statusCode = res.statusCode || 200;
        return originalSend.call(this, data);
    };
    
    // Log after response is sent
    res.on('finish', async () => {
        try {
            const responseTime = Date.now() - startTime;
            
            // Extract phone_id from headers or body
            const phone_id = req.headers['phone-id'] || req.body?.phone_id || null;
            
            // Extract API key ID if available
            const api_key_id = req.apiKey?.id || null;
            
            // Get IP address
            const ip_address = req.ip || 
                             req.headers['x-forwarded-for']?.split(',')[0] || 
                             req.connection?.remoteAddress || 
                             null;
            
            // Get user agent
            const user_agent = req.headers['user-agent'] || null;
            
            // Determine success
            const success = statusCode >= 200 && statusCode < 400;
            
            // Extract error message if failed
            let error_message = null;
            if (!success && responseBody) {
                if (typeof responseBody === 'string') {
                    error_message = responseBody;
                } else if (responseBody.error) {
                    error_message = responseBody.error;
                } else if (responseBody.message) {
                    error_message = responseBody.message;
                }
            }
            
            // Extract message_id from response if available
            let message_id = null;
            if (responseBody && typeof responseBody === 'object') {
                message_id = responseBody.messageId || responseBody.message_id || null;
            }
            
            // Create sanitized request body (remove sensitive data)
            const sanitizedRequestBody = sanitizeRequestBody(req.body);
            
            // Create log entry
            await ApiLog.create({
                phone_id,
                endpoint: req.originalUrl || req.url,
                method: req.method,
                request_body: sanitizedRequestBody,
                response_body: typeof responseBody === 'object' ? responseBody : { data: responseBody },
                status_code: statusCode,
                success,
                error_message,
                ip_address,
                user_agent,
                response_time: responseTime,
                api_key_id,
                message_id
            });
        } catch (error) {
            // Don't fail the request if logging fails
            console.error('API logging error:', error);
        }
    });
    
    next();
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body) {
    if (!body || typeof body !== 'object') {
        return body;
    }
    
    const sanitized = { ...body };
    
    // List of sensitive fields to mask
    const sensitiveFields = ['password', 'token', 'api_key', 'secret', 'apiKey'];
    
    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '***REDACTED***';
        }
    }
    
    return sanitized;
}

module.exports = { apiLoggerMiddleware };
