const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), async (req, res) => {
    try {
        console.log('Callback received for user:', req.user?.discordId); // 除錯日誌
        if (!req.user) {
            console.error('No user in session after callback');
            return res.redirect('/?error=no_user');
        }

        // 驗證成員 ID
        const allowedIds = process.env.ALLOWED_MEMBER_IDS?.split(',') || [];
        const isAllowed = allowedIds.includes(req.user.discordId) || req.user.discordId === process.env.MASTER_ADMIN_ID;
        if (!isAllowed) {
            console.log(`Unauthorized user: ${req.user.discordId}`);
            req.logout((err) => {
                if (err) console.error('Logout error:', err);
                res.redirect('/?error=invalid_member');
            });
            return;
        }

        // 確保 session 保存
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/?error=session_error');
            }
            console.log(`Session saved for user: ${req.user.discordId}`);
            res.redirect('/index.html'); // 明確重定向到設定頁面
        });
    } catch (err) {
        console.error('Callback error:', err);
        res.redirect('/?error=callback_error');
    }
});

router.get('/logout', (req, res) => {
    console.log('User logging out:', req.user?.discordId);
    req.logout((err) => {
        if (err) console.error('Logout error:', err);
        req.session.destroy(() => {
            res.redirect('/');
        });
    });
});

module.exports = router;