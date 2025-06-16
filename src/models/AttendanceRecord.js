const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    battleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Battle', required: true },
    attended: { type: Boolean, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);