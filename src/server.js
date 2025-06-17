const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');
const app = express();

// Session 配置
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60 // 1 天
    }),
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

// 初始化 Passport
app.use(passport.initialize());
app.use(passport.session());

// 靜態檔案
app.use(express.static(path.join(__dirname, '../public')));

// 保護路由
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        console.log(`Authenticated user: ${req.user.discordId}`);
        return next();
    }
    console.log('Unauthenticated access attempt');
    res.redirect('/?error=unauthenticated');
};

// 路由
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

// 頁面路由
app.get(['/', '/index.html'], (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
        res.sendFile(path.join(__dirname, '../public/login.html')); // 登入頁面
    }
});

app.get('/home.html', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/home.html'));
});

// 404 處理
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});