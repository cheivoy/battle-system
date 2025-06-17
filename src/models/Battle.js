const mongoose = require('mongoose');

const battleSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['open', 'closed', 'published', 'confirmed', 'draft'], default: 'open' },
    formation: {
        groups: [String],
        teams: [String],
        assignments: { type: Object, default: {} }
    }
});

module.exports = mongoose.model('Battle', battleSchema);