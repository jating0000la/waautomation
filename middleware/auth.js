// Simple authentication middleware
// TODO: Replace with your actual authentication system

function requireAuth(req, res, next) {
    // Check if we're in development mode (only allow bypass in true development)
    const isDevelopment = process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true';
    
    if (isDevelopment) {
        console.warn('⚠️ Authentication bypassed - Development Mode (NODE_ENV=development, BYPASS_AUTH=true)');
        req.user = { 
            id: 'dev-user', 
            role: 'admin',
            username: 'developer' 
        };
        return next();
    }
    
    // Production authentication logic
    // Check if user is authenticated via session or authorization header
    const isAuthenticated = req.session?.user || req.headers.authorization;
    
    if (!isAuthenticated) {
        return res.status(401).json({ 
            error: 'Authentication required',
            message: 'Please log in to access this resource'
        });
    }
    
    // If we have a session user, use that
    if (req.session?.user) {
        req.user = req.session.user;
        return next();
    }
    
    // If we have authorization header, validate it (basic implementation)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // TODO: Implement proper JWT or token validation here
        // For now, accept any bearer token as valid (replace with real validation)
        req.user = {
            id: 'token-user',
            role: 'user',
            username: 'authenticated-user'
        };
        return next();
    }
    
    return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide valid authentication credentials'
    });
}

function optionalAuth(req, res, next) {
    // Attach user info if available but don't require it
    if (req.session?.user) {
        req.user = req.session.user;
    }
    next();
}

module.exports = {
    requireAuth,
    optionalAuth
};
