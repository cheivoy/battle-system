// 路由設定 - 注意順序很重要！
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

// ✅ 首頁根據登入狀態導向 - 必須在靜態檔案中間件之前
app.get('/', (req, res) => {
    console.log('Root route accessed');
    console.log('User authenticated:', req.isAuthenticated());
    console.log('User object:', req.user);
    
    if (req.isAuthenticated()) {
        // 檢查用戶是否完成初始設定
        if (req.user.gameId && req.user.job) {
            console.log('✅ User configured, redirecting to home.html');
            return res.redirect('/home.html');
        } else {
            console.log('✅ User logged in but not configured, redirecting to index.html');
            return res.redirect('/index.html');
        }
    } else {
        console.log('❌ User not logged in, redirecting to login.html');
        return res.redirect('/login.html');
    }
});

// 登入驗證中介
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        console.log(`✅ Authenticated user: ${req.user.discordId}`);
        return next();
    }
    console.log('❌ Unauthenticated access attempt');
    res.redirect('/login.html?error=unauthenticated');
};

// ✅ 保護頁面（例如 home）
app.get('/home.html', ensureAuthenticated, (req, res) => {
    const filePath = path.join(publicPath, 'home.html');
    console.log(`Serving home.html at ${filePath}`);
    res.sendFile(filePath, err => {
        if (err) {
            console.error('Error serving home.html:', err.message);
            res.status(404).send('Page not found');
        }
    });
});

// ✅ 其他需要保護的頁面也要加上驗證
app.get('/index.html', ensureAuthenticated, (req, res) => {
    const filePath = path.join(publicPath, 'index.html');
    console.log(`Serving index.html at ${filePath}`);
    res.sendFile(filePath, err => {
        if (err) {
            console.error('Error serving index.html:', err.message);
            res.status(404).send('Page not found');
        }
    });
});

// 靜態檔案目錄 - 移到路由定義之後
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// ✅ 404 fallback route
app.get('*', (req, res) => {
    const filePath = path.join(publicPath, '404.html');
    console.log(`Serving 404.html at ${filePath}`);
    res.status(404).sendFile(filePath, err => {
        if (err) {
            console.error('Error serving 404.html:', err.message);
            res.status(404).send('Page not found');
        }
    });
});