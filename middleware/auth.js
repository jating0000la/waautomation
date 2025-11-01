// Simple authentication middleware
// TODO: Replace with your actual authentication system

function requireAuth(req, res, next) {
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
