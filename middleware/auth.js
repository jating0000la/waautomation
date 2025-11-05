// Simple authentication middleware
// TODO: Replace with your actual authentication system

function requireAuth(req, res, next) {
    // Always bypass authentication for local development
    // In production, implement proper authentication
    console.warn('⚠️ Authentication bypassed - Development Mode');
    req.user = { 
        id: 'dev-user', 
        role: 'admin',
        username: 'developer' 
    };
    return next();
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
