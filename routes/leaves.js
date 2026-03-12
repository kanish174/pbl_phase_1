const express = require('express');
const Leave = require('../models/Leave');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all leaves (HR sees all, employee sees only their own)
router.get('/', auth, async (req, res) => {
  try {
    const userRoles = req.user.roles || [req.user.role];
    const isHR = userRoles.includes('hr');
    
    let leaves;
    if (isHR) {
      leaves = await Leave.find()
        .populate('employee', 'username email department')
        .populate('reviewedBy', 'username')
        .sort({ createdAt: -1 });
    } else {
      leaves = await Leave.find({ employee: req.user._id })
        .populate('reviewedBy', 'username')
        .sort({ createdAt: -1 });
    }
    
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Apply for leave (Employee)
router.post('/', auth, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const leave = new Leave({
      employee: req.user._id,
      leaveType,
      startDate,
      endDate,
      reason
    });
    
    await leave.save();
    await leave.populate('employee', 'username email department');
    
    res.status(201).json({ 
      message: 'Leave application submitted successfully',
      leave 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update leave status (HR only)
router.put('/:id/status', auth, authorize(['hr']), async (req, res) => {
  try {
    const { status, reviewComment } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }
    
    leave.status = status;
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.reviewComment = reviewComment;
    
    await leave.save();
    await leave.populate('employee', 'username email department');
    await leave.populate('reviewedBy', 'username');
    
    res.json({ 
      message: `Leave ${status} successfully`,
      leave 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete leave (Employee can delete only pending leaves)
router.delete('/:id', auth, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }
    
    const userRoles = req.user.roles || [req.user.role];
    const isHR = userRoles.includes('hr');
    
    if (!isHR && leave.employee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access forbidden' });
    }
    
    if (!isHR && leave.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot delete approved/rejected leave' });
    }
    
    await Leave.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Leave deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
