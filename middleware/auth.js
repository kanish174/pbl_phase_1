const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Session-based authentication middleware
const sessionAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Access denied - Please log in' });
    }
    
    const user = await User.findById(req.session.userId);
    if (!user) {
      if (req.session.destroy) {
        req.session.destroy();
      }
      return res.status(401).json({ message: 'Invalid session - User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Session auth error:', error);
    res.status(401).json({ message: 'Authentication error' });
  }
};

// JWT-based authentication middleware (for API compatibility)
const jwtAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Access denied - No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id || decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token - User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT auth error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token format' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Combined authentication middleware (tries session first, then JWT)
const auth = async (req, res, next) => {
  // Try session authentication first
  if (req.session && req.session.userId) {
    return sessionAuth(req, res, next);
  }
  
  // Fall back to JWT authentication
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    return jwtAuth(req, res, next);
  }
  
  return res.status(401).json({ message: 'Access denied - Please log in' });
};

// Role-based authorization middleware (updated for multiple roles)
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Ensure allowedRoles is an array
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    // Check if user has any of the allowed roles - check both roles array and single role
    const userRoles = req.user.roles || [req.user.role];
    const hasPermission = userRoles.some(role => rolesArray.includes(role));
    
    if (!hasPermission) {
      return res.status(403).json({ 
        message: 'Access forbidden - Insufficient permissions',
        required: rolesArray,
        userRoles: userRoles
      });
    }
    
    next();
  };
};

// Middleware to check specific role
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const hasRole = req.user.hasRole ? 
      req.user.hasRole(role) : 
      req.user.role === role;
    
    if (!hasRole) {
      return res.status(403).json({ 
        message: `Access forbidden - ${role} role required`,
        userRoles: req.user.roles || [req.user.role]
      });
    }
    
    next();
  };
};

module.exports = { 
  auth, 
  sessionAuth, 
  jwtAuth, 
  authorize, 
  requireRole 
};