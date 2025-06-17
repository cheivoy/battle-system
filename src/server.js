const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const MongoStore = require('connect-mongo');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();

// MongoDB 連線 (移到最前面)
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// 中間件設定順序很重要
// 1. CORS 設定 (必須在所有路由之前)
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? 'https://battle-system.onrender.com' 
        : 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// 2. Express JSON 解析
app.use(express.json());

// 3. Session 設定 (修正 cookie 設定)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 小時
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // 跨域必須設定
    }
}));

// 4. Passport 初始化
app.use(passport.initialize());
app.use(passport.session());

// Passport Discord 策略
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const User = require('./models/User');
        let user = await User.findOne({ discordId: profile.id });
        if (!user) {
            user = new User({
                discordId: profile.id,
                discordUsername: profile.username
            });
            await user.save();
        }
        return done(null, user);
    } catch (err) {
        console.error('Discord strategy error:', err);
        return done(err);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const User = require('./models/User');
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        console.error('Deserialize user error:', err);
        done(err);
    }
});

// 路由
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// 靜態檔案服務
app.use(express.static(path.join(__dirname, '../public')));

// 頁面路由
const pages = [
    'index.html', 'home.html',
    'applications/job_change.html', 'applications/id_change.html', 'applications/leave.html', 'applications/proxy_registration.html',
    'records/attendance.html',
    'admin/battle_management.html', 'admin/member_management.html', 'admin/formation_management.html', 'admin/statistics.html', 'admin/change_logs.html'
];

pages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, '../public', page));
    });
});

// 健康檢查端點
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
});

// 404 處理
app.use((req, res) => {
    res.status(404).json({ success: false, message: '找不到資源' });
});

// 啟動伺服器
const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});