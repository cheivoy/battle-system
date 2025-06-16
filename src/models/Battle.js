const mongoose = require('mongoose');

const battleSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    formation: [{
        name: String,
        teams: [{
            name: String,
            members: [{
                job: String,
                player: String
            }]
        }]
    }],
    formationPublished: { type: Boolean, default: false },
    formationConfirmed: { type: Boolean, default: false }
});

module.exports = mongoose.model('Battle', battleSchema);