const express = require('express');
const Criteria = require('../models/Criteria');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.post('/', auth, authorize(['admin']), async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User authentication required' });
    }
    
    const criteria = new Criteria({ ...req.body, createdBy: req.user._id });
    await criteria.save();
    res.status(201).json(criteria);
  } catch (error) {
    console.error('Criteria creation error:', error);
    res.status(400).json({ message: error.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const criteria = await Criteria.find({ isActive: true });
    res.json(criteria);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, authorize(['admin']), async (req, res) => {
  try {
    const criteria = await Criteria.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(criteria);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;