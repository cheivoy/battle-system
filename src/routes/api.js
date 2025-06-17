const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Battle = require('../models/Battle');
const Registration = require('../models/Registration');
const LeaveRequest = require('../models/LeaveRequest');
const ChangeLog = require('../models/ChangeLog');
const Attendance = require('../models/Attendance');


function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ success: false, message: '請先登入' });
}

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) return next();
    res.status(403).json({ success: false, message: '無管理員權限' });
}

// 檢查用戶是否需要首次設定
router.get('/user/setup', ensureAuthenticated, (req, res) => {
    if (req.user.gameId) {
        return res.json({ success: false, message: '用戶已設定' });
    }
    res.json({ success: true });
});

// 用戶註冊
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
        req.user.isAdmin = isAdmin || false;
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

// 獲取當前用戶資訊
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

// 更改遊戲 ID
router.post('/user/change-id', ensureAuthenticated, async (req, res) => {
    const { gameId } = req.body;
    if (!gameId) {
        return res.status(400).json({ success: false, message: '請輸入遊戲 ID' });
    }
    if (!/^[a-zA-Z0-9]{3,20}$/.test(gameId)) {
        return res.status(400).json({ success: false, message: '遊戲 ID 必須為 3-20 字元的字母或數字' });
    }
    try {
        const existingUser = await User.findOne({ gameId });
        if (existingUser && existingUser.discordId !== req.user.discordId) {
            return res.status(400).json({ success: false, message: '此遊戲 ID 已存在' });
        }
        const oldGameId = req.user.gameId;
        req.user.gameId = gameId;
        await req.user.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${oldGameId} 更改遊戲 ID 為 ${gameId}`,
            type: 'id_change',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '更換失敗' });
    }
});

// 更改職業
router.post('/user/change-job', ensureAuthenticated, async (req, res) => {
    const { job } = req.body;
    if (!job) {
        return res.status(400).json({ success: false, message: '請選擇職業' });
    }
    const validJobs = ['素問', '血河', '九靈', '龍吟', '碎夢', '神相', '鐵衣'];
    if (!validJobs.includes(job)) {
        return res.status(400).json({ success: false, message: '無效的職業' });
    }
    try {
        const oldJob = req.user.job;
        req.user.job = job;
        await req.user.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `用戶 ${req.user.gameId} 更改職業從 ${oldJob} 為 ${job}`,
            type: 'job_change',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '更換失敗' });
    }
});

// 獲取當前幫戰
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

// 開啟幫戰
router.post('/battle/open', ensureAdmin, async (req, res) => {
    const { date, deadline } = req.body;
    if (!date || !deadline) {
        return res.status(400).json({ success: false, message: '請填寫所有欄位' });
    }
    try {
        const existingBattle = await Battle.findOne({ status: 'open' });
        if (existingBattle) {
            return res.status(400).json({ success: false, message: '已有一場幫戰正在進行' });
        }
        const battle = new Battle({
            date: new Date(date),
            deadline: new Date(deadline),
            status: 'open',
            formation: [],
            formationPublished: false
        });
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 開啟幫戰，日期: ${date}, 截止時間: ${deadline}`,
            type: 'battle_open',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '新增失敗' });
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
            message: `管理員 ${req.user.gameId} 關閉幫戰`,
            type: 'battle_close',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '關閉失敗' });
    }
});

// 報名幫戰
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

// 取消報名
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

// 代報名
router.post('/registration/proxy', ensureAdmin, async (req, res) => {
    const { targetId, reason } = req.body;
    if (!targetId || !reason) {
        return res.status(400).json({ success: false, message: '請填寫所有欄位' });
    }
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle || new Date(battle.deadline) < new Date()) {
            return res.status(400).json({ success: false, message: '無開放報名或已截止' });
        }
        const targetUser = await User.findOne({ gameId: targetId });
        if (!targetUser) {
            return res.status(400).json({ success: false, message: '目標用戶不存在' });
        }
        const existingReg = await Registration.findOne({ userId: targetId, battleId: battle._id });
        if (existingReg) {
            return res.status(400).json({ success: false, message: '目標用戶已報名' });
        }
        const leave = await LeaveRequest.findOne({ userId: targetId, date: battle.date });
        if (leave) {
            return res.status(400).json({ success: false, message: '目標用戶已請假' });
        }
        const registration = new Registration({
            userId: targetId,
            battleId: battle._id,
            job: targetUser.job
        });
        await registration.save();
        await ChangeLog.create({
            userId: targetId,
            message: `管理員 ${req.user.gameId} 為 ${targetId} 代報名幫戰，原因: ${reason}`,
            type: 'proxy_register',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '提交失敗' });
    }
});

// 獲取報名狀態
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

// 獲取報名列表
router.get('/registration/list', ensureAdmin, async (req, res) => {
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.json({ success: false, message: '無開放的幫戰' });
        }
        const registrations = await Registration.find({ battleId: battle._id });
        const players = await Promise.all(registrations.map(async reg => {
            const user = await User.findOne({ gameId: reg.userId });
            return { gameId: reg.userId, job: user?.job || reg.job };
        }));
        res.json({ success: true, players });
    } catch (err) {
        res.status(500).json({ success: false, message: '查詢失敗' });
    }
});

// 保存出戰表
router.post('/formation/save', ensureAdmin, async (req, res) => {
    const { formation } = req.body;
    if (!formation || !Array.isArray(formation)) {
        return res.status(400).json({ success: false, message: '無效的陣型數據' });
    }
    try {
        const battle = await Battle.findOne({ status: 'open' });
        if (!battle) {
            return res.status(400).json({ success: false, message: '無開放的幫戰' });
        }
        battle.formation = formation;
        await battle.save();
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 保存出戰表`,
            type: 'formation_save',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '保存失敗' });
    }
});

// 發佈出戰表
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
            message: `管理員 ${req.user.gameId} 發佈出戰表`,
            type: 'formation_publish',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '發佈失敗' });
    }
});

// 提交請假申請
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

// 獲取成員列表
router.get('/members/list', ensureAdmin, async (req, res) => {
    try {
        const members = await User.find({}, 'gameId job').lean();
        const leaveRequests = await LeaveRequest.find({ date: { $gte: new Date() } }).lean();
        const membersWithStatus = members.map(member => {
            const onLeave = leaveRequests.some(lr => lr.userId === member.gameId);
            return { ...member, onLeave };
        });
        res.json({ success: true, members: membersWithStatus });
    } catch (err) {
        res.status(500).json({ success: false, message: '無法載入成員列表' });
    }
});

// 切換成員請假狀態
router.post('/members/toggle-leave', ensureAdmin, async (req, res) => {
    const { gameId, onLeave } = req.body;
    if (!gameId) {
        return res.status(400).json({ success: false, message: '請提供遊戲 ID' });
    }
    try {
        const user = await User.findOne({ gameId });
        if (!user) {
            return res.status(400).json({ success: false, message: '用戶不存在' });
        }
        if (onLeave) {
            const existingLeave = await LeaveRequest.findOne({ userId: gameId, date: { $gte: new Date() } });
            if (!existingLeave) {
                const leave = new LeaveRequest({ userId: gameId, date: new Date() });
                await leave.save();
            }
        } else {
            await LeaveRequest.deleteMany({ userId: gameId, date: { $gte: new Date() } });
        }
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 將 ${gameId} 的請假狀態設為 ${onLeave ? '請假' : '正常'}`,
            type: 'leave_toggle',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '更新失敗' });
    }
});

// 刪除成員
router.post('/members/delete', ensureAdmin, async (req, res) => {
    const { gameId } = req.body;
    if (!gameId) {
        return res.status(400).json({ success: false, message: '請提供遊戲 ID' });
    }
    try {
        const user = await User.findOneAndDelete({ gameId });
        if (!user) {
            return res.status(400).json({ success: false, message: '用戶不存在' });
        }
        await Registration.deleteMany({ userId: gameId });
        await LeaveRequest.deleteMany({ userId: gameId });
        await ChangeLog.create({
            userId: req.user.gameId,
            message: `管理員 ${req.user.gameId} 刪除用戶 ${gameId}`,
            type: 'member_delete',
            timestamp: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '刪除失敗' });
    }
});

// 獲取統計報表
router.get('/stats', ensureAdmin, async (req, res) => {
    try {
        const totalMembers = await User.countDocuments();
        const battle = await Battle.findOne({ status: 'open' });
        let registered = 0;
        let onLeave = 0;
        if (battle) {
            registered = await Registration.countDocuments({ battleId: battle._id });
            onLeave = await LeaveRequest.countDocuments({ date: battle.date });
        }
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

// 獲取異動記錄
router.get('/change-logs', ensureAdmin, async (req, res) => {
    const { date, userId, type } = req.query;
    try {
        const query = {};
        if (date) query.timestamp = { $gte: new Date(date), $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)) };
        if (userId) query.userId = userId;
        if (type) query.type = type;
        const logs = await ChangeLog.find(query).sort({ timestamp: -1 }).lean();
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: '無法載入異動記錄' });
    }
});

// 新增端點：GET /api/attendance/user - 獲取使用者的出勤記錄和統計數據
router.get('/attendance/user', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.gameId; // 假設 req.user 包含已驗證使用者的資料

        // 查詢使用者的所有出勤記錄
        const attendanceRecords = await Attendance.find({ userId }).lean();

        // 查詢所有已結束的戰鬥，用於計算總戰鬥次數
        const pastBattles = await Battle.find({ status: 'closed' }).lean();

        // 計算參加的戰鬥次數
        const attended = attendanceRecords.filter(record => record.status === 'attended').length;

        // 計算出勤率
        const totalBattles = pastBattles.length;
        const attendanceRate = totalBattles > 0 ? (attended / totalBattles * 100).toFixed(2) : 0;

        // 準備出勤記錄列表，包含戰鬥詳情
        const records = await Promise.all(attendanceRecords.map(async (record) => {
            const battle = await Battle.findById(record.battleId).lean();
            return {
                date: battle?.date.toLocaleDateString('zh-TW'), // 日期格式化為台灣慣用格式
                battle: battle?.name || '未知幫戰', // 戰鬥名稱或備用值
                team: record.team || '未分配', // 隊伍名稱或備用值
                status: record.status // 出勤狀態
            };
        }));

        // 返回前端所需的資料格式
        res.json({
            success: true,
            stats: {
                attendanceRate, // 例如 "75.00"
                attended // 例如 3
            },
            records // 出勤記錄列表
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '無法載入出勤紀錄' });
    }
});

module.exports = router;
