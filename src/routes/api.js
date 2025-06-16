const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Battle = require('../models/Battle');
const Registration = require('../models/Registration');
const LeaveRequest = require('../models/LeaveRequest');
const ChangeLog = require('../models/ChangeLog');

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ success: false, message: '請先登入' });
}

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) return next();
    res.status(403).json({ success: false, message: '無管理員權限' });
}

router.get('/user/setup', ensureAuthenticated, (req, res) => {
    if (req.user.gameId) {
        return res.json({ success: false, message: '用戶已設定' });
    }
    res.json({ success: true });
});

router.post('/user/register', ensureAuthenticated, async (req, res) => {
    const { gameId, job, isAdmin } = req.body;
    if (!gameId || !job) {
        return res.status(400).json({ success: false, message: '請填寫所有必要欄位' });
    }
    if (!/^[a-zA-Z0-9]{3,20}$/.test(gameId)) {
        return res.status(400).json({ success: false, message: '遊戲 ID 格式錯誤' });
    }
    try {
        const existingUser = await User.findOne({ gameId });
        if (existingUser) {
            return res.status(400).json({ success: false, message: '此遊戲 ID 已存在' });
        }
        req.user.gameId = gameId;
        req.user.job = job;
        req.user.isAdmin = isAdmin;
        await req.user.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${gameId} 註冊，職業: ${job}`,
            type: 'register',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '註冊失敗' });
    }
});

router.get('/user/current', ensureAuthenticated, (req, res) => {
    res.json({ success: true, user: {
        gameId: req.user.gameId,
        job: req.user.job,
        isAdmin: req.user.isAdmin
    }});
});

router.get('/battle/current', ensureAuthenticated, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.json({ success: false });
        }
        res.json({ success: true, battle });
    } catch (err) {
        res.status(500).json({ success: false, message: '查詢失敗' });
    }
});

router.post('/registration/register', ensureAuthenticated, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle || new Date(battle.deadline) < new Date()) {
            return res.status(400).json({ success: false, message: '無開放報名或已截止' });
        }
        const existingReg = await Registration.findOne({ userId: req.user.gameId, battleId: battle._id });
        if (existingReg) {
            return res.status(400).json({ success: false, message: '已報名' });
        }
        const leave = await LeaveRequest.findOne({ userId: req.user.gameId, date: battle.date });
        if (leave) {
            return res.status(400).json({ success: false, message: '您已請假' });
        }
        const registration = new Registration({
            userId: req.user.gameId,
            battleId: battle._id,
            job: req.user.job
        });
        await registration.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 報名幫戰`,
            type: 'register',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '報名失敗' });
    }
});

router.post('/registration/cancel', ensureAuthenticated, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle || new Date(battle.deadline) < new Date()) {
            return res.status(400).json({ success: false, message: '無開放報名或已截止' });
        }
        const registration = await Registration.findOneAndDelete({ userId: req.user.gameId, battleId: battle._id });
        if (!registration) {
            return res.status(400).json({ success: false, message: '未報名' });
        }
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 取消幫戰報名`,
            type: 'cancel',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '取消失敗' });
    }
});

router.get('/registration/status', ensureAuthenticated, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.json({ success: false });
        }
        const registration = await Registration.findOne({ userId: req.user.gameId, battleId: battle._id });
        if (!registration) {
            return res.json({ success: false });
        }
        const team = battle.formation
            .flatMap(group => group.teams)
            .find(team => team.members.some(m => m.player === req.user.gameId))?.name;
        res.json({ success: true, registered: true, team });
    } catch (err) {
        res.status(500).json({ success: false, message: '查詢失敗' });
    }
});

router.post('/leave/submit', ensureAuthenticated, async (req, res) => {
    const { date } = req.body;
    if (!date) {
        return res.status(400).json({ success: false, message: '請選擇日期' });
    }
    try {
        const existingLeave = await LeaveRequest.findOne({ userId: req.user.gameId, date });
        if (existingLeave) {
            return res.status(400).json({ success: false, message: '該日期已請假' });
        }
        const leave = new LeaveRequest({ userId: req.user.gameId, date });
        await leave.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 申請請假，日期: ${date}`,
            type: 'leave',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '提交失敗' });
    }
});

module.exports = router;