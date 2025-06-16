const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true },
    discordUsername: { type: String, required: true },
    gameId: { type: String, unique: true, sparse: true },
    job: { type: String },
    isAdmin: { type: Boolean, default: false },
    onLeave: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);