const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    battleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Battle', required: true },
    isProxy: { type: Boolean, default: false },
    proxyReason: { type: String },
    proxyBy: { type: String },
    isWaitlist: { type: Boolean, default: false }
});

module.exports = mongoose.model('Registration', registrationSchema);