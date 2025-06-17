const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const { createClient } = require('redis');
const passport = require('passport');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

dotenv.config();
const app = express();

// 建立 Redis 客戶端
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected to MongoDB'));

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

app.get('*', (req, res) => res.sendFile(__dirname + '/public/index.html'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));