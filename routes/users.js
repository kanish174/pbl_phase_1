const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

const EMPLOYEE_EMAIL_SUFFIX = '.reviewpro@gmail.com';

function normalizeUsernameBase(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

async function buildUniqueEmployeeEmail(username) {
  const base = normalizeUsernameBase(username);
  if (!base) {
    throw new Error('Username must contain letters or numbers');
  }

  let attempt = 0;
  while (attempt < 1000) {
    const localPart = attempt === 0 ? `${base}.reviewpro` : `${base}${attempt}.reviewpro`;
    const email = `${localPart}@gmail.com`;
    const exists = await User.exists({ email });
    if (!exists) {
      return email;
    }
    attempt += 1;
  }

  throw new Error('Could not generate unique employee email. Try a different username.');
}

function generateSystemPassword() {
  return `${crypto.randomBytes(8).toString('hex')}A1!`;
}

router.get('/', auth, async (req, res) => {
  try {
    // Allow hr to see all users
    // Employees can only see themselves
    const roles = req.user.roles || [req.user.role];
    const canViewAll = roles.some(r => ['hr'].includes(r));
    
    if (canViewAll) {
      const users = await User.find().select('-password');
      res.json(users);
    } else {
      // Return only the current user
      const user = await User.findById(req.user._id).select('-password');
      res.json([user]);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single user
router.get('/:id', auth, async (req, res) => {
  try {
    // Users can view their own profile, hr can view any profile
    if (req.params.id !== req.user._id.toString() && 
        !req.user.hasAnyRole(['hr'])) {
      return res.status(403).json({ message: 'Access forbidden' });
    }
    
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user roles (hr only)
router.put('/:id/roles', auth, authorize(['hr']), async (req, res) => {
  try {
    const { roles } = req.body;
    
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ message: 'Roles must be a non-empty array' });
    }
    
    const validRoles = ['hr', 'employee'];
    const invalidRoles = roles.filter(role => !validRoles.includes(role));
    
    if (invalidRoles.length > 0) {
      return res.status(400).json({ 
        message: `Invalid roles: ${invalidRoles.join(', ')}`,
        validRoles
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { roles }, 
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      message: 'Roles updated successfully', 
      user 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update single role (for backward compatibility)
router.put('/:id/role', auth, authorize(['hr']), async (req, res) => {
  try {
    const { role } = req.body;
    
    const validRoles = ['hr', 'employee'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        message: `Invalid role: ${role}`,
        validRoles
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { roles: [role] }, // Update roles array with single role
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      message: 'Role updated successfully', 
      user 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new user (hr only)
router.post('/', auth, authorize(['hr']), async (req, res) => {
  try {
    const { username, department } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const trimmedUsername = username.trim();
    const existingUser = await User.findOne({ username: trimmedUsername });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const generatedEmail = await buildUniqueEmployeeEmail(trimmedUsername);
    if (!generatedEmail.endsWith(EMPLOYEE_EMAIL_SUFFIX)) {
      return res.status(500).json({ message: 'Generated employee email format is invalid' });
    }

    const systemPassword = generateSystemPassword();

    const user = new User({ 
      username: trimmedUsername,
      email: generatedEmail,
      password: systemPassword,
      roles: ['employee'],
      department,
      mustChangePassword: false
    });
    
    await user.save();
    
    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({ 
      message: 'User created successfully', 
      user: userResponse,
      onboarding: {
        loginType: 'google-only',
        approvedGoogleEmail: generatedEmail
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete user (hr only)
router.delete('/:id', auth, authorize(['hr']), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
