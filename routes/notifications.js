const express = require('express');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Get user notifications
router.get('/', auth, async (req, res) => {
  try {
    // Mock notifications data
    const notifications = [
      {
        id: 1,
        message: 'New performance review assigned',
        type: 'review',
        read: false,
        createdAt: new Date()
      },
      {
        id: 2,
        message: 'Review deadline approaching',
        type: 'deadline',
        read: false,
        createdAt: new Date(Date.now() - 86400000)
      },
      {
        id: 3,
        message: 'Performance criteria updated',
        type: 'system',
        read: false,
        createdAt: new Date(Date.now() - 172800000)
      }
    ];
    
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;