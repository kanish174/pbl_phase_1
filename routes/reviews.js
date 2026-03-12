const express = require('express');
const Review = require('../models/Review');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all reviews (for hr)
router.get('/all', auth, authorize(['hr']), async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('employee', 'username email')
      .populate('reviewer', 'username')
      .populate('ratings.criteria', 'name')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, authorize(['hr']), async (req, res) => {
  try {
    const review = new Review({ ...req.body, reviewer: req.user._id });
    await review.save();
    res.status(201).json(review);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/employee/:id', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ employee: req.params.id })
      .populate('reviewer', 'username')
      .populate('ratings.criteria', 'name');
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, authorize(['hr']), async (req, res) => {
  try {
    const { ratings, feedback, status } = req.body;
    const overallScore = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
    
    const review = await Review.findByIdAndUpdate(req.params.id, {
      ratings, feedback, status, overallScore,
      ...(status === 'completed' && { completedAt: new Date() })
    }, { new: true });
    
    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
