function authorize(...allowedRoles) {
  return (req, res, next) => {
    // Check if user object exists (should be set by authMiddleware)
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ success: false, message: 'Access denied: missing role information' });
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }

    next();
  };
}

module.exports = {
  authorize
};
