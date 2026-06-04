const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// --- 1. إعدادات البوت والاتصال بقاعدة البيانات ---
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

// --- 2. إعدادات موقع الداشبورد (Express) ---
const app = express();

app.use(session({
    secret: 'replit-flat-ipad-secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// توليد رابط الـ Callback تلقائياً الخاص بـ Replit
const CALLBACK_URL = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/auth/callback`;

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

// --- 3. مسارات الموقع (بدون مجلدات - قراءة مباشرة للملفات) ---

// الصفحة الرئيسية
app.get('/', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    // استبدال بسيط لعرض زر الدخول أو لوحة التحكم
    if (req.user) {
        html = html.replace('', '<a href="/dashboard" class="btn">الانتقال للوحة التحكم</a>');
    } else {
        html = html.replace('', '<a href="/auth/discord" class="btn">تسجيل الدخول عبر ديسكورد</a>');
    }
    res.send(html);
});

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/dashboard');
});

// صفحة لوحة التحكم والسيرفرات
app.get('/dashboard', (req, res) => {
    if (!req.user) return res.redirect('/auth/discord');

    // تصفية السيرفرات (الأونر أو الإداري فقط)
    const adminGuilds = req.user.guilds.filter(guild => {
        const isAdmin = (guild.permissions & 0x8) === 0x8;
        return guild.owner || isAdmin;
    });

    let html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
    
    // وضع اسم المستخدم
    html = html.replace('<%= username %>', req.user.username);

    // بناء قائمة السيرفرات تلقائياً وإدخالها في الـ HTML
    let guildsHtml = '';
    adminGuilds.forEach(guild => {
        guildsHtml += `<div class="guild-card"><span><strong>${guild.name}</strong></span>`;
        if (client.guilds.cache.has(guild.id)) {
            guildsHtml += `<a href="/dashboard/${guild.id}" class="btn-manage">تعديل الإعدادات ⚙️</a>`;
        } else {
            guildsHtml += `<a href="https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot&guild_id=${guild.id}" target="_blank" class="btn-invite">دعوة البوت ➕</a>`;
        }
        guildsHtml += `</div>`;
    });

    html = html.replace('', guildsHtml);
    res.send(html);
});

app.get('/logout', (req, res) => {
    req.logout(() => { res.redirect('/'); });
});

// تشغيل السيرفر والبوت معاً
app.listen(3000, () => {
    console.log('🌐 لوحة التحكم تعمل وجاهزة!');
});

client.login(process.env.DISCORD_TOKEN);
