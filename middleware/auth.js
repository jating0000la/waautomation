// Simple authentication middleware
// TODO: Replace with your actual authentication system

function requireAuth(req, res, next) {
    // TEMPORARY BYPASS FOR DEVELOPMENT/TESTING
    // ⚠️ WARNING: This bypasses all authentication!
    // TODO: Implement proper authentication before production deployment!
    
    console.warn('⚠️ Authentication bypassed - Development Mode');
    req.user = { 
        id: 'dev-user', 
        role: 'admin',
        username: 'developer' 
    };
    next();
    
    /* ORIGINAL CODE - Uncomment when authentication is implemented:
    // Check if user is authenticated
    // This is a placeholder - implement your actual auth logic
    const isAuthenticated = req.session?.user || req.headers.authorization;
    
    if (!isAuthenticated) {
        return res.status(401).json({ 
            error: 'Authentication required',
            message: 'Please log in to access this resource'
        });
    }
    
    next();
    */
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
