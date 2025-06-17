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

// 用戶設定檢查
router.get('/user/setup', ensureAuthenticated, (req, res) => {
    if (req.user.gameId) {
        return res.json({ success: false, message: '用戶已設定' });
    }
    res.json({ success: true });
});

// 用戶註冊
router.post('/user/register', ensureAuthenticated, async (req, res) => {
    const { gameId, job } = req.body;
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
        req.user.isAdmin = false; // 預設非管理員
        await req.user.save();
        await ChangeLog.create({
            userId: gameId,
            message: `用戶 ${gameId} 註冊，職業: ${job}`,
            type: 'register',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '註冊失敗' });
    }
});

// 當前用戶資訊
router.get('/user/current', ensureAuthenticated, (req, res) => {
    res.json({
        success: true,
        user: {
            gameId: req.user.gameId,
            job: req.user.job,
            isAdmin: req.user.isAdmin
        }
    });
});

// 更換職業
router.post('/user/change-job', ensureAuthenticated, async (req, res) => {
    const { job } = req.body;
    if (!job) {
        return res.status(400).json({ success: false, message: '請選擇職業' });
    }
    try {
        const oldJob = req.user.job;
        req.user.job = job;
        await req.user.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 將職業從 ${oldJob} 更改為 ${job}`,
            type: 'job_change',
            timestamp: new Date()
        });
        res.json({ success: true, message: '職業更改成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '更改職業失敗' });
    }
});

// 更改遊戲 ID
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
        const oldGameId = req.user.gameId;
        req.user.gameId = gameId;
        await req.user.save();
        await Registration.updateMany({ userId: oldGameId }, { userId: gameId });
        await LeaveRequest.updateMany({ userId: oldGameId }, { userId: gameId });
        await AttendanceRecord.updateMany({ userId: oldGameId }, { userId: gameId });
        await ChangeLog.create({
            userId: gameId,
            message: `用戶 ${oldGameId} 更改遊戲 ID 為 ${gameId}`,
            type: 'id_change',
            timestamp: new Date()
        });
        res.json({ success: true, message: '遊戲 ID 更改成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '更改遊戲 ID 失敗' });
    }
});

// 當前幫戰資訊
router.get('/battle/current', ensureAuthenticated, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: { $in: ['open', 'published'] } });
        if (!battle) {
            return res.json({ success: false, message: '無當前幫戰' });
        }
        const registration = await Registration.findOne({ userId: req.user.gameId, battleId: battle._id });
        let formation = null;
        if (registration && battle.formation && battle.status === 'published') {
            const assignments = battle.formation.assignments;
            for (const group in assignments) {
                for (const team in assignments[group]) {
                    for (const job in assignments[group][team]) {
                        if (assignments[group][team][job] === req.user.gameId) {
                            formation = { group, team, job };
                            break;
                        }
                    }
                }
            }
        }
        res.json({ success: true, battle, registration: !!registration, formation });
    } catch (err) {
        res.status(500).json({ success: false, message: '無法載入幫戰資訊' });
    }
});

// 開啟幫戰
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
        const lastBattle = await Battle.findOne({ status: 'published' });
        if (lastBattle) {
            return res.status(400).json({ success: false, message: '請先確認上次幫戰的最終陣型' });
        }
        const battle = new Battle({
            date: new Date(date),
            deadline: new Date(deadline),
            formation: { groups: ['團1', '團2'], teams: ['進攻隊', '防守隊', '機動隊', '空拆隊', '拆塔隊'], assignments: {} }
        });
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 開啟幫戰，時間: ${new Date(date).toLocaleString()}`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true, message: '幫戰已開啟' });
    } catch (err) {
        res.status(500).json({ success: false, message: '開啟幫戰失敗' });
    }
});

// 關閉幫戰
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
            message: `管理員 ${req.user.gameId} 關閉幫戰，時間: ${new Date(battle.date).toLocaleString()}`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true, message: '幫戰已關閉' });
    } catch (err) {
        res.status(500).json({ success: false, message: '關閉幫戰失敗' });
    }
});

// 報名幫戰
router.post('/registration/register', ensureAuthenticated, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無開放的幫戰' });
        }
        const user = await User.findOne({ gameId: req.user.gameId });
        if (user.onLeave) {
            return res.status(400).json({ success: false, message: '請假中，無法報名' });
        }
        const existingRegistration = await Registration.findOne({ userId: req.user.gameId, battleId: battle._id });
        if (existingRegistration) {
            return res.status(400).json({ success: false, message: '已報名' });
        }
        const isAlternate = new Date() > new Date(battle.deadline);
        const registration = new Registration({
            userId: req.user.gameId,
            battleId: battle._id,
            isAlternate
        });
        await registration.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} ${isAlternate ? '加入備選名單' : '報名幫戰'}，時間: ${new Date(battle.date).toLocaleString()}`,
            type: 'register',
            timestamp: new Date()
        });
        res.json({ success: true, message: isAlternate ? '已超過報名時間，已加入備選名單' : '報名成功', isAlternate });
    } catch (err) {
        res.status(500).json({ success: false, message: '報名失敗' });
    }
});

// 取消報名
router.post('/registration/cancel', ensureAuthenticated, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無開放的幫戰' });
        }
        const registration = await Registration.findOne({ userId: req.user.gameId, battleId: battle._id });
        if (!registration) {
            return res.status(400).json({ success: false, message: '尚未報名' });
        }
        await Registration.deleteOne({ _id: registration._id });
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 取消幫戰報名，時間: ${new Date(battle.date).toLocaleString()}`,
            type: 'cancel',
            timestamp: new Date()
        });
        res.json({ success: true, message: '取消報名成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '取消報名失敗' });
    }
});

// 代報名
router.post('/registration/proxy', ensureAuthenticated, async (req, res) => {
    const { targetGameId, reason } = req.body;
    if (!targetGameId || !reason) {
        return res.status(400).json({ success: false, message: '請填寫所有欄位' });
    }
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無開放的幫戰' });
        }
        const targetUser = await User.findOne({ gameId: targetGameId });
        if (!targetUser) {
            return res.status(400).json({ success: false, message: '目標用戶不存在' });
        }
        if (targetUser.onLeave) {
            return res.status(400).json({ success: false, message: '目標用戶請假中' });
        }
        const existingRegistration = await Registration.findOne({ userId: targetGameId, battleId: battle._id });
        if (existingRegistration) {
            return res.status(400).json({ success: false, message: '目標用戶已報名' });
        }
        const isAlternate = new Date() > new Date(battle.deadline);
        const registration = new Registration({
            userId: targetGameId,
            battleId: battle._id,
            isProxy: true,
            proxyReason: reason,
            proxyBy: req.user.gameId,
            isAlternate
        });
        await registration.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 為 ${targetGameId} 代報名幫戰，原因: ${reason}${isAlternate ? '（備選名單）' : ''}`,
            type: 'register',
            timestamp: new Date()
        });
        res.json({ success: true, message: '代報名成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '代報名失敗' });
    }
});

// 查詢備選名單
router.get('/registration/alternate', ensureAuthenticated, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無開放的幫戰' });
        }
        const alternates = await Registration.find({ battleId: battle._id, isAlternate: true }).select('userId');
        res.json({ success: true, alternates: alternates.map(r => r.userId) });
    } catch (err) {
        res.status(500).json({ success: false, message: '無法載入備選名單' });
    }
});

// 請假申請
router.post('/leave/submit', ensureAuthenticated, async (req, res) => {
    const { date } = req.body;
    if (!date) {
        return res.status(400).json({ success: false, message: '請選擇日期' });
    }
    try {
        const leaveDate = new Date(date);
        const existingLeave = await LeaveRequest.findOne({ userId: req.user.gameId, date: leaveDate });
        if (existingLeave) {
            return res.status(400).json({ success: false, message: '該日期已申請請假' });
        }
        const leaveRequest = new LeaveRequest({
            userId: req.user.gameId,
            date: leaveDate
        });
        await leaveRequest.save();
        await User.updateOne({ gameId: req.user.gameId }, { onLeave: true });
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 申請請假，日期: ${leaveDate.toLocaleDateString()}`,
            type: 'leave',
            timestamp: new Date()
        });
        res.json({ success: true, message: '請假申請成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '請假申請失敗' });
    }
});

// 出勤記錄
router.get('/attendance/user', ensureAuthenticated, async (req, res) => {
    try {
        const records = await AttendanceRecord.find({ userId: req.user.gameId }).sort({ battleDate: -1 });
        const totalBattles = records.length;
        const attended = records.filter(r => r.attended).length;
        const attendanceRate = totalBattles ? ((attended / totalBattles) * 100).toFixed(2) : 0;
        res.json({
            success: true,
            stats: {
                attendanceRate,
                totalBattles,
                absences: totalBattles - attended
            },
            records
        });
    } catch (err) {
        res.status(500).json({ success: false, message: '無法載入出勤記錄' });
    }
});

// 成員列表
router.get('/members/list', ensureAdmin, async (req, res) => {
    const { job } = req.query;
    try {
        const query = job && job !== 'all' ? { job } : {};
        const members = await User.find(query).select('gameId job onLeave isAdmin');
        res.json({ success: true, members });
    } catch (err) {
        res.status(500).json({ success: false, message: '無法載入成員列表' });
    }
});

// 切換請假狀態
router.post('/members/toggle-leave', ensureAdmin, async (req, res) => {
    const { gameId } = req.body;
    if (!gameId) {
        return res.status(400).json({ success: false, message: '請提供遊戲 ID' });
    }
    try {
        const user = await User.findOne({ gameId });
        if (!user) {
            return res.status(400).json({ success: false, message: '用戶不存在' });
        }
        user.onLeave = !user.onLeave;
        await user.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 將 ${gameId} 的請假狀態設為 ${user.onLeave ? '請假' : '正常'}`,
            type: 'leave',
            timestamp: new Date()
        });
        res.json({ success: true, message: '請假狀態更新成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '更新請假狀態失敗' });
    }
});

// 切換管理員狀態
router.post('/members/toggle-admin', ensureAdmin, async (req, res) => {
    const { gameId } = req.body;
    if (!gameId) {
        return res.status(400).json({ success: false, message: '請提供遊戲 ID' });
    }
    try {
        const user = await User.findOne({ gameId });
        if (!user) {
            return res.status(400).json({ success: false, message: '用戶不存在' });
        }
        user.isAdmin = !user.isAdmin;
        await user.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 將 ${gameId} 的管理員狀態設為 ${user.isAdmin ? '管理員' : '普通用戶'}`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true, message: '管理員狀態更新成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '更新管理員狀態失敗' });
    }
});

// 刪除成員
router.post('/members/delete', ensureAdmin, async (req, res) => {
    const { gameId } = req.body;
    if (!gameId) {
        return res.status(400).json({ success: false, message: '請提供遊戲 ID' });
    }
    try {
        const user = await User.findOne({ gameId });
        if (!user) {
            return res.status(400).json({ success: false, message: '用戶不存在' });
        }
        await User.deleteOne({ gameId });
        await Registration.deleteMany({ userId: gameId });
        await LeaveRequest.deleteMany({ userId: gameId });
        await AttendanceRecord.deleteMany({ userId: gameId });
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 刪除用戶 ${gameId}`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true, message: '用戶刪除成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '刪除用戶失敗' });
    }
});

// 出戰表
router.get('/formation/current', ensureAdmin, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: { $in: ['closed', 'published'] } });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無可編輯的幫戰' });
        }
        const registrations = await Registration.find({ battleId: battle._id });
        const registeredUsers = await User.find({ gameId: { $in: registrations.map(r => r.userId) } }).select('gameId job');
        res.json({
            success: true,
            formation: battle.formation,
            registeredUsers
        });
    } catch (err) {
        res.status(500).json({ success: false, message: '無法載入出戰表' });
    }
});

// 儲存出戰表
router.post('/formation/save', ensureAdmin, async (req, res) => {
    const { assignments } = req.body;
    try {
        const battle = await Battle.findOne({ status: 'closed' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無可編輯的幫戰' });
        }
        const usedUsers = new Set();
        for (const group in assignments) {
            for (const team in assignments[group]) {
                for (const job in assignments[group][team]) {
                    const gameId = assignments[group][team][job];
                    if (gameId && usedUsers.has(gameId)) {
                        return res.status(400).json({ success: false, message: `用戶 ${gameId} 被重複分配` });
                    }
                    if (gameId) usedUsers.add(gameId);
                }
            }
        }
        battle.formation.assignments = assignments;
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 儲存出戰表`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true, message: '出戰表儲存成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '儲存出戰表失敗' });
    }
});

// 發佈出戰表
router.post('/formation/publish', ensureAdmin, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'closed' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無可發佈的幫戰' });
        }
        battle.status = 'published';
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 發佈出戰表`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true, message: '出戰表發佈成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '發佈出戰表失敗' });
    }
});

// 確認最終陣型
router.post('/formation/confirm', ensureAdmin, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'published' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無可確認的幫戰' });
        }
        battle.status = 'confirmed';
        const assignments = battle.formation.assignments;
        for (const group in assignments) {
            for (const team in assignments[group]) {
                for (const job in assignments[group][team]) {
                    const gameId = assignments[group][team][job];
                    if (gameId) {
                        await AttendanceRecord.create({
                            userId: gameId,
                            battleId: battle._id,
                            battleDate: battle.date,
                            group,
                            team,
                            attended: true
                        });
                    }
                }
            }
        }
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 確認最終陣型`,
            type: 'other',
            timestamp: new Date()
        });
        res.json({ success: true, message: '最終陣型確認成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '確認陣型失敗' });
    }
});

// 統計數據
router.get('/stats', ensureAdmin, async (req, res) => {
    try {
        const totalMembers = await User.countDocuments();
        const battle = await Battle.findOne({ status: 'open' });
        const registered = battle ? await Registration.countDocuments({ battleId: battle._id }) : 0;
        const onLeave = await User.countDocuments({ onLeave: true });
        res.json({
            success: true,
            stats: {
                totalMembers,
                registered,
                onLeave
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: '無法載入統計數據' });
    }
});

// 異動記錄
router.get('/change-logs', ensureAdmin, async (req, res) => {
    const { date, userId, type } = req.query;
    try {
        const query = {};
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setDate(end.getDate() + 1);
            query.timestamp = { $gte: start, $lt: end };
        }
        if (userId) query.userId = userId;
        if (type) query.type = type;
        const logs = await ChangeLog.find(query).sort({ timestamp: -1 }).limit(50);
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: '無法載入異動記錄' });
    }
});

module.exports = router;