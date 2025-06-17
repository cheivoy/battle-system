const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    battleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Battle', required: true },
    battleDate: { type: Date, required: true },
    group: { type: String },
    team: { type: String },
    attended: { type: Boolean, default: false },
    registered: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);