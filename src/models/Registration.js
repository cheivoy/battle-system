const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    battleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Battle', required: true },
    job: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isBackup: { type: Boolean, default: false }
});

module.exports = mongoose.model('Registration', registrationSchema);