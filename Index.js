const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');

// 1. إعدادات البوت والاتصال بقاعدة البيانات
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ متصل بقاعدة البيانات بنجاح!'))
    .catch(err => console.error('❌ خطأ في قاعدة البيانات:', err));

client.once('ready', () => {
    console.log(`🤖 البوت يعمل باسم: ${client.user.tag}`);
});

// 2. إعدادات موقع الداشبورد (Express)
const app = express();
app.set('view engine', 'ejs');

app.use(session({
    secret: 'replit-ipad-dashboard-secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// رابط الـ Callback الخاص بـ Replit تلقائياً
// سيكون على شكل: https://اسم-المشروع.اسم-المستخدم.repl.co/auth/callback
// تأكد من نسخه ووضعه في Discord Developer Portal -> OAuth2 -> Redirects
const CALLBACK_URL = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/auth/callback`;

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

// 3. مسارات الموقع (Routes)
app.get('/', (req, res) => {
    res.render('index', { user: req.user });
});

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
    if (!req.user) return res.redirect('/auth/discord');

    // تصفية السيرفرات (الأونر أو الإداري فقط)
    const adminGuilds = req.user.guilds.filter(guild => {
        const isAdmin = (guild.permissions & 0x8) === 0x8;
        return guild.owner || isAdmin;
    });

    res.render('dashboard', {
        user: req.user,
        guilds: adminGuilds,
        bot: client
    });
});

app.get('/logout', (req, res) => {
    req.logout(() => { res.redirect('/'); });
});

// تشغيل السيرفر والبوت معاً
app.listen(3000, () => {
    console.log('🌐 لوحة التحكم تعمل داخلياً على منفذ 3000');
});

client.login(process.env.DISCORD_TOKEN);
