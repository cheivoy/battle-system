const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);