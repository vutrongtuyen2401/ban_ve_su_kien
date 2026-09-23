const { authorize } = require('./roleMiddleware');
const { authenticateToken } = require('./authMiddleware');

// Define route permissions
// 'public' means no auth required
// An array means auth required, and the user must have one of those roles
const routePermissions = {
  'GET /api/events': 'public',
  'POST /api/events': ['admin', 'organizer']
  // If a route is not defined here, it defaults to deny (403)
};

function normalizePath(path) {
  // Remove trailing slashes and query params for matching
  let normalized = path.split('?')[0];
  if (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function enforceRoutePermissions(req, res, next) {
  const method = req.method.toUpperCase();
  const path = normalizePath(req.path);
  const routeKey = `${method} ${path}`;

  const permission = routePermissions[routeKey];

  if (permission === 'public') {
    return next();
  }

  if (Array.isArray(permission)) {
    // Route requires specific roles, so we need authentication first, then authorization
    return authenticateToken(req, res, (err) => {
      if (err) return next(err); // if authenticateToken threw an error, though it usually responds directly
      
      // If authenticateToken succeeds, it calls next() inside it, but we intercepted it
      // Let's call authorize with the allowed roles
      const authorizeMiddleware = authorize(...permission);
      return authorizeMiddleware(req, res, next);
    });
  }

  // Deny by default (route not registered)
  return res.status(403).json({ success: false, message: 'Access denied: route not permitted' });
}

module.exports = {
  enforceRoutePermissions
};
