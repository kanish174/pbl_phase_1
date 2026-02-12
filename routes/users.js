const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    // Allow admin, manager, hr to see all users
    // Employees can only see themselves
    const roles = req.user.roles || [req.user.role];
    const canViewAll = roles.some(r => ['admin', 'manager', 'hr'].includes(r));
    
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
    // Users can view their own profile, admins/managers/hr can view any profile
    if (req.params.id !== req.user._id.toString() && 
        !req.user.hasAnyRole(['admin', 'manager', 'hr'])) {
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

// Update user roles (admin only)
router.put('/:id/roles', auth, authorize(['admin']), async (req, res) => {
  try {
    const { roles } = req.body;
    
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ message: 'Roles must be a non-empty array' });
    }
    
    const validRoles = ['admin', 'manager', 'hr', 'employee'];
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
router.put('/:id/role', auth, authorize(['admin']), async (req, res) => {
  try {
    const { role } = req.body;
    
    const validRoles = ['admin', 'manager', 'hr', 'employee'];
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

// Create new user (admin/hr only)
router.post('/', auth, authorize(['admin', 'hr']), async (req, res) => {
  try {
    const { username, email, password, roles, role, department } = req.body;
    
    // Handle both single role and multiple roles
    let userRoles = [];
    if (roles && Array.isArray(roles)) {
      userRoles = roles;
    } else if (role) {
      userRoles = [role];
    } else {
      userRoles = ['employee'];
    }
    
    const user = new User({ 
      username, 
      email, 
      password, 
      roles: userRoles,
      department 
    });
    
    await user.save();
    
    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({ 
      message: 'User created successfully', 
      user: userResponse 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete user (admin/hr only)
router.delete('/:id', async (req, res) => {
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