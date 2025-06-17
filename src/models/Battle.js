const mongoose = require('mongoose');

const battleSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'open', 'closed', 'published', 'confirmed'], default: 'pending' },
    formation: {
        groups: [String],
        teams: [String],
        assignments: mongoose.Schema.Types.Mixed
    }
});

module.exports = mongoose.model('Battle', battleSchema);