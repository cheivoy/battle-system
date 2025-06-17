const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Battle = require('../models/Battle');
const Registration = require('../models/Registration');
const LeaveRequest = require('../models/LeaveRequest');
const AttendanceRecord = require('../models/AttendanceRecord');
const ChangeLog = require('../models/ChangeLog');

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ success: false, message: '請先登入' });
}

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) return next();
    res.status(403).json({ success: false, message: '無管理員權限' });
}

// 現有 API（保留之前的 /user/setup, /user/register, /user/current, /battle/current, /registration/register, /registration/cancel, /registration/status, /leave/submit）

router.post('/user/change-job', ensureAuthenticated, async (req, res) => {
    const { job } = req.body;
    if (!job || !['素問', '血河', '九靈', '龍吟', '碎夢', '神相', '鐵衣'].includes(job)) {
        return res.status(400).json({ success: false, message: '無效的職業' });
    }
    try {
        const oldJob = req.user.job;
        req.user.job = job;
        await req.user.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 將職業從 ${oldJob} 更換為 ${job}`,
            type: 'job_change',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '更換失敗' });
    }
});

router.post('/user/change-id', ensureAuthenticated, async (req, res) => {
    const { gameId } = req.body;
    if (!gameId || !/^[a-zA-Z0-9]{3,20}$/.test(gameId)) {
        return res.status(400).json({ success: false, message: '遊戲 ID 格式錯誤' });
    }
    try {
        const existingUser = await User.findOne({ gameId });
        if (existingUser) {
            return res.status(400).json({ success: false, message: '此遊戲 ID 已存在' });
        }
        const oldId = req.user.gameId;
        req.user.gameId = gameId;
        await req.user.save();
        await ChangeLog.create({
            userId: gameId,
            message: `用戶將遊戲 ID 從 ${oldId} 更換為 ${gameId}`,
            type: 'id_change',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '更換失敗' });
    }
});

router.post('/registration/proxy', ensureAuthenticated, async (req, res) => {
    const { targetId, reason } = req.body;
    if (!targetId || !reason) {
        return res.status(400).json({ success: false, message: '請填寫所有欄位' });
    }
    try {
        const targetUser = await User.findOne({ gameId: targetId });
        if (!targetUser) {
            return res.status(400).json({ success: false, message: '目標用戶不存在' });
        }
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle || new Date(battle.deadline) < new Date()) {
            return res.status(400).json({ success: false, message: '無開放報名或已截止' });
        }
        const existingReg = await Registration.findOne({ userId: targetId, battleId: battle._id });
        if (existingReg) {
            return res.status(400).json({ success: false, message: '目標用戶已報名' });
        }
        const registration = new Registration({
            userId: targetId,
            battleId: battle._id,
            job: targetUser.job
        });
        await registration.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 為 ${targetId} 代報名，原因：${reason}`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '代報名失敗' });
    }
});

router.get('/attendance/user', ensureAuthenticated, async (req, res) => {
    try {
        const records = await AttendanceRecord.find({ userId: req.user.gameId }).populate('battleId');
        const total = records.length;
        const attended = records.filter(r => r.attended).length;
        const stats = {
            attendanceRate: total ? (attended / total * 100) : 0,
            attended,
            absent: total - attended
        };
        const formattedRecords = records.map(r => ({
            date: r.battleId.date,
            battleName: `幫戰 ${new Date(r.battleId.date).toLocaleDateString('zh-TW')}`,
            team: r.battleId.formation
                .flatMap(g => g.teams)
                .find(t => t.members.some(m => m.player === req.user.gameId))?.name || '-',
            attended: r.attended
        }));
        res.json({ success: true, stats, records: formattedRecords });
    } catch (err) {
        res.status(500).json({ success: false, message: '查詢失敗' });
    }
});

router.post('/battle/open', ensureAdmin, async (req, res) => {
    const { date, deadline } = req.body;
    if (!date || !deadline) {
        return res.status(400).json({ success: false, message: '請填寫所有欄位' });
    }
    try {
        const existingBattle = await Battle.findOne({ status: 'open' });
        if (existingBattle) {
            return res.status(400).json({ success: false, message: '已有開放的幫戰' });
        }
        const battle = new Battle({ date, deadline });
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 新增幫戰，日期：${new Date(date).toLocaleString('zh-TW')}`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '新增失敗' });
    }
});

router.post('/battle/close', ensureAdmin, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無開放的幫戰' });
        }
        battle.status = 'closed';
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 關閉幫戰，日期：${new Date(battle.date).toLocaleString('zh-TW')}`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '關閉失敗' });
    }
});

router.get('/members/list', ensureAdmin, async (req, res) => {
    const { job } = req.query;
    try {
        const query = job ? { job } : {};
        const members = await User.find(query).select('gameId job onLeave');
        res.json({ success: true, members });
    } catch (err) {
        res.status(500).json({ success: false, message: '查詢失敗' });
    }
});

router.post('/members/toggle-leave', ensureAdmin, async (req, res) => {
    const { gameId, onLeave } = req.body;
    try {
        const user = await User.findOne({ gameId });
        if (!user) {
            return res.status(400).json({ success: false, message: '用戶不存在' });
        }
        user.onLeave = onLeave;
        await user.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 將 ${gameId} 的狀態設為 ${onLeave ? '請假' : '正常'}`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '更新失敗' });
    }
});

router.post('/members/delete', ensureAdmin, async (req, res) => {
    const { gameId } = req.body;
    try {
        const user = await User.findOneAndDelete({ gameId });
        if (!user) {
            return res.status(400).json({ success: false, message: '用戶不存在' });
        }
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 刪除成員 ${gameId}`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '刪除失敗' });
    }
});

router.get('/registration/list', ensureAdmin, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.json({ success: false, message: '無開放的幫戰' });
        }
        const registrations = await Registration.find({ battleId: battle._id }).select('userId job');
        res.json({ success: true, players: registrations });
    } catch (err) {
        res.status(500).json({ success: false, message: '查詢失敗' });
    }
});

router.post('/formation/save', ensureAdmin, async (req, res) => {
    const { formation } = req.body;
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無開放的幫戰' });
        }
        battle.formation = formation;
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 保存陣型`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '保存失敗' });
    }
});

router.post('/formation/publish', ensureAdmin, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無開放的幫戰' });
        }
        battle.formationPublished = true;
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 發佈陣型`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '發佈失敗' });
    }
});

router.post('/formation/confirm', ensureAdmin, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無開放的幫戰' });
        }
        if (!battle.formationPublished) {
            return res.status(400).json({ success: false, message: '請先發佈陣型' });
        }
        battle.formationConfirmed = true;
        await battle.save();
        // 記錄出勤
        const registrations = await Registration.find({ battleId: battle._id });
        for (const reg of registrations) {
            const attended = battle.formation
                .flatMap(g => g.teams)
                .some(t => t.members.some(m => m.player === reg.userId));
            await AttendanceRecord.create({
                userId: reg.userId,
                battleId: battle._id,
                attended
            });
        }
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 確認陣型並記錄出勤`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '確認失敗' });
    }
});

router.get('/stats', ensureAdmin, async (req, res) => {
    try {
        const totalMembers = await User.countDocuments();
        const registered = await Registration.countDocuments({ battleId: (await Battle.findOne({ status: 'open' }))?._id });
        const onLeave = await User.countDocuments({ onLeave: true });
        res.json({ success: true, stats: { totalMembers, registered, onLeave } });
    } catch (err) {
        res.status(500).json({ success: false, message: '查詢失敗' });
    }
});

router.get('/change-logs', ensureAdmin, async (req, res) => {
    const { date, userId, type } = req.query;
    try {
        const query = {};
        if (date) query.timestamp = { $gte: new Date(date), $lt: new Date(date).setDate(new Date(date).getDate() + 1) };
        if (userId) query.userId = userId;
        if (type) query.type = type;
        const logs = await ChangeLog.find(query).sort({ timestamp: -1 });
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: '查詢失敗' });
    }
});

module.exports = router;
