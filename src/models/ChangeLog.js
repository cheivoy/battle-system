const mongoose = require('mongoose');

const changeLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChangeLog', changeLogSchema);