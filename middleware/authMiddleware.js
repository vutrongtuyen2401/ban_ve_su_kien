const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Fetch user and roles
    const user = await db('users').where({ id: payload.userId, is_active: true }).first();
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' });
    }

    const roles = await db('roles')
      .join('user_roles', 'roles.id', '=', 'user_roles.role_id')
      .where('user_roles.user_id', user.id)
      .select('roles.name');

    req.user = {
      id: user.id,
      email: user.email,
      roles: roles.map(r => r.name)
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

module.exports = {
  authenticateToken,
  JWT_SECRET // exported for testing purposes if needed
};
