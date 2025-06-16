const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback', passport.authenticate('discord', { failureRedirect: '/index.html' }), async (req, res) => {
    if (!req.user.gameId) {
        res.redirect('/index.html?setup=true');
    } else {
        res.redirect('/home.html');
    }
});

router.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) return res.status(500).json({ success: false, message: '登出失敗' });
        req.session.destroy();
        res.redirect('/index.html');
    });
});

module.exports = router;