const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), async (req, res) => {
    const allowedIds = process.env.ALLOWED_MEMBER_IDS ? process.env.ALLOWED_MEMBER_IDS.split(',') : [];
    const masterAdminId = process.env.MASTER_ADMIN_ID;

    if (!req.user.gameId) {
        if (allowedIds.length > 0 && !allowedIds.includes(req.user.discordId) && req.user.discordId !== masterAdminId) {
            await User.deleteOne({ discordId: req.user.discordId });
            req.logout(() => {});
            return res.redirect('/?error=無效成員ID');
        }
        return res.redirect('/');
    }
    res.redirect('/home.html');
});

router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

module.exports = router;