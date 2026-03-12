const express = require('express');
const jwt = require('jsonwebtoken');
const https = require('https');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const router = express.Router();
const EMPLOYEE_EMAIL_PATTERN = /^[a-z0-9]+(?:\d+)?\.reviewpro@gmail\.com$/;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            resolve(parsed);
          } catch (error) {
            reject(new Error('Invalid JSON response from Google token verification'));
          }
        });
      })
      .on('error', (error) => reject(error));
  });
}

function buildAuthPayload(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    roles: user.roles,
    role: user.role,
    department: user.department,
    mustChangePassword: Boolean(user.mustChangePassword)
  };
}

function isEmployeeOnly(user) {
  const roles = user?.roles || [user?.role];
  return roles.includes('employee') && !roles.includes('hr');
}

async function verifyGoogleIdToken(idToken, expectedAudience) {
  const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const tokenInfo = await fetchJson(tokenInfoUrl);

  if (tokenInfo.error_description || tokenInfo.error) {
    throw new Error(tokenInfo.error_description || tokenInfo.error || 'Invalid Google token');
  }
  if (String(tokenInfo.aud) !== String(expectedAudience)) {
    throw new Error('Google token audience mismatch');
  }
  if (tokenInfo.email_verified !== 'true') {
    throw new Error('Google account email is not verified');
  }
  if (!tokenInfo.email) {
    throw new Error('Google token does not include email');
  }

  return tokenInfo;
}

// Add CORS headers for auth routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

router.post('/register', async (req, res) => {
  res.status(403).json({
    message: 'Self-signup is disabled. Please contact HR for your account credentials.',
  });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database not available. Please ensure MongoDB is running.' 
      });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (isEmployeeOnly(user)) {
      return res.status(403).json({
        message: 'Employee password login is disabled. Please use Google Sign-In.'
      });
    }

    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Store user in session
    req.session.userId = user._id;
    const sessionPayload = buildAuthPayload(user);
    req.session.user = sessionPayload;
    
    // Also provide JWT token for API compatibility
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        roles: user.roles,
        mustChangePassword: Boolean(user.mustChangePassword)
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      message: 'Login successful',
      token, 
      user: {
        ...sessionPayload
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Login failed' });
  }
});

router.get('/google-config', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  res.json({
    enabled: Boolean(clientId),
    clientId
  });
});

router.post('/google-login', async (req, res) => {
  try {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return res.status(503).json({ message: 'Google login is not configured on server' });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    const tokenInfo = await verifyGoogleIdToken(credential, googleClientId);
    const email = String(tokenInfo.email).toLowerCase().trim();
    if (!EMPLOYEE_EMAIL_PATTERN.test(email)) {
      return res.status(403).json({
        message: 'Google account is not an approved ReviewPro employee email format'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(403).json({
        message: 'No employee account found for this Google email. Please contact HR.'
      });
    }

    const roles = user.roles || [user.role];
    if (!roles.includes('employee')) {
      return res.status(403).json({ message: 'Google login is allowed only for employee accounts' });
    }

    req.session.userId = user._id;
    const googleUserPayload = {
      ...buildAuthPayload(user),
      mustChangePassword: false
    };

    req.session.user = googleUserPayload;

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        mustChangePassword: false
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Google login successful',
      token,
      user: {
        ...googleUserPayload
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ message: error.message || 'Google login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  res.json({ user: req.session.user });
});

router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (isEmployeeOnly(user)) {
      return res.status(403).json({
        message: 'Employee password change is disabled. Employees use Google Sign-In.'
      });
    }

    const passwordMatches = await user.comparePassword(currentPassword);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    if (req.session && req.session.user) {
      req.session.user.mustChangePassword = false;
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: error.message || 'Could not change password' });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({ 
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

module.exports = router;
