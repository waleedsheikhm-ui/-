const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, 'NexusOS');

// 1. إنشاء المجلدات
console.log('📂 إنشاء هيكل المشروع...');
if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR);
if (!fs.existsSync(path.join(ROOT_DIR, 'public'))) fs.mkdirSync(path.join(ROOT_DIR, 'public'));

// 2. دالة لكتابة الملفات
const writeFile = (filename, content) => {
    const filePath = path.join(ROOT_DIR, filename);
    fs.writeFileSync(filePath, content.trim());
    console.log(`✅ تم إنشاء: ${filename}`);
};

// 3. محتوى الملفات (كما زودتك سابقاً)

// package.json
writeFile('package.json', `
{
  "name": "nexus-os",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "sqlite3": "^5.1.6"
  }
}
`);

// database.js
writeFile('database.js', `
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'nexus_os.db');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) => new Promise((res, rej) => db.run(sql, params, (err) => err ? rej(err) : res()));
const all = (sql, params = []) => new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const get = (sql, params = []) => new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));

// دالة تنظيف البيانات (إزالة المسافات الزائدة من المفاتيح والقيم)
const cleanData = (obj) => {
    if (Array.isArray(obj)) return obj.map(cleanData);
    if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.trim(), cleanData(v)]));
    }
    return obj;
};

async function initDB() {
    console.log('🔌 جاري الاتصال بقاعدة البيانات...');
    await run(`CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY, name TEXT, dept TEXT, spec TEXT, color TEXT, icon TEXT, rating REAL, tasks INTEGER, done INTEGER, active INTEGER, score REAL)`);
    await run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT, dept TEXT, emp_id INTEGER, pri TEXT, status TEXT, due TEXT, desc TEXT, score REAL, branch TEXT, ai_reason TEXT)`);
    await run(`CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, name TEXT, manager TEXT, employees INTEGER, budget REAL, revenue REAL, tasks INTEGER, kpi REAL)`);
    await run(`CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY, type TEXT, icon TEXT, title TEXT, sub TEXT, time TEXT)`);
    await run(`CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, client TEXT, amount REAL, status TEXT, date TEXT, due TEXT, type TEXT, emp TEXT)`);
    await run(`CREATE TABLE IF NOT EXISTS pipeline (id INTEGER PRIMARY KEY, title TEXT, client TEXT, value REAL, stage TEXT, prob INTEGER, emp TEXT, due TEXT)`);
    await run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);

    const count = await get(`SELECT COUNT(*) as c FROM employees`);
    if (count.c === 0) {
        console.log('⚙️ جاري تعبئة البيانات من data.json...');
        try {
            const rawData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
            const data = cleanData(rawData);

            for (const e of data.employees) await run(`INSERT OR IGNORE INTO employees VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [e.id, e.name, e.dept, e.spec, e.color, e.icon, e.rating, e.tasks, e.done, e.active, e.score]);
            for (const t of data.tasks) await run(`INSERT OR IGNORE INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [t.id, t.title, t.dept, t.empId || null, t.pri, t.status, t.due, t.desc || '', t.score, t.branch || '', t.ai_reason || null]);
            for (const d of data.departments) await run(`INSERT OR IGNORE INTO departments VALUES (?,?,?,?,?,?,?,?)`, [d.id, d.name, d.manager, d.employees, d.budget, d.revenue, d.tasks, d.kpi]);
            for (const a of data.alerts) await run(`INSERT OR IGNORE INTO alerts VALUES (?,?,?,?,?,?)`, [a.id || Math.random(), a.type, a.icon, a.title, a.sub, a.time]);
            for (const inv of data.invoices) await run(`INSERT OR IGNORE INTO invoices VALUES (?,?,?,?,?,?,?,?)`, [inv.id, inv.client, inv.amount, inv.status, inv.date, inv.due, inv.type, inv.emp]);
            for (const p of data.pipeline) await run(`INSERT OR IGNORE INTO pipeline VALUES (?,?,?,?,?,?,?,?)`, [p.id, p.title, p.client, p.value, p.stage, p.prob, p.emp, p.due]);
            
            await run(`INSERT OR IGNORE INTO settings VALUES ('ai_auto_assign', 'true')`);
            console.log('✅ تم تعبئة البيانات بنجاح!');
        } catch (err) {
            console.error('❌ خطأ في قراءة البيانات:', err.message);
        }
    }
}

module.exports = { db, run, all, get, initDB };
`);

// server.js
writeFile('server.js', `
const express = require('express');
const path = require('path');
const cors = require('cors');
const { run, all, get, initDB } = require('./database');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 🤖 Logic: جلب لوحة القيادة
app.get('/api/dashboard', async (_, res) => {
    const tasks = await all(`SELECT * FROM tasks`);
    const lateTasks = tasks.filter(t => t.status === 'متأخرة');
    const activeCount = tasks.filter(t => t.status === 'قيد التنفيذ').length;
    const alerts = await all(`SELECT * FROM alerts ORDER BY id DESC LIMIT 5`);
    const departments = await all(`SELECT * FROM departments`);
    const totalRevenue = departments.reduce((sum, d) => sum + d.revenue, 0);
    const chaosRatio = lateTasks.length / tasks.length;
    let chaos = { level: 'مستقر', color: 'green' };
    if (chaosRatio > 0.25) chaos = { level: 'حرج', color: 'red' };
    else if (chaosRatio > 0.1) chaos = { level: 'متوتر', color: 'yellow' };

    res.json({ chaos, stats: { total: tasks.length, late: lateTasks.length, active: activeCount, revenue: totalRevenue }, alerts });
});

// 📋 Logic: إدارة المهام
app.get('/api/tasks', async (_, res) => res.json(await all(`SELECT * FROM tasks`)));

app.post('/api/tasks', async (req, res) => {
    const { title, dept, pri, desc, due } = req.body;
    const settings = await all(`SELECT * FROM settings`);
    const autoAssign = settings.find(s => s.key === 'ai_auto_assign')?.value === 'true';
    let empId = null;
    let aiReason = 'إسناد يدوي';

    if (autoAssign) {
        const candidate = await get(`SELECT e.id, e.active FROM employees e WHERE e.dept = ? ORDER BY e.active ASC LIMIT 1`, [dept]);
        if (candidate) {
            empId = candidate.id;
            aiReason = `🤖 AI Auto-Assigned: Lowest load (${candidate.active} active)`;
            await run(`UPDATE employees SET active = active + 1 WHERE id = ?`, [empId]);
        }
    }

    const id = Math.floor(Math.random() * 1000) + 20;
    await run(`INSERT INTO tasks (id, title, dept, emp_id, pri, status, due, desc, ai_reason) VALUES (?, ?, ?, ?, ?, 'جديدة', ?, ?, ?)`,
        [id, title, dept, empId, pri, due, desc || '', aiReason]);
    res.json({ success: true, id, assignedTo: empId, reason: aiReason });
});

// ⚙️ Logic: الإعدادات
app.get('/api/settings', async (_, res) => res.json(await all(`SELECT * FROM settings`)));
app.post('/api/settings', async (req, res) => {
    const { key, value } = req.body;
    await run(`INSERT OR REPLACE INTO settings VALUES (?, ?)`, [key, value]);
    res.json({ success: true });
});

// تشغيل النظام
initDB().then(() => {
    const PORT = 3000;
    app.listen(PORT, () => console.log(`🚀 NEXUS OS RUNNING ON http://localhost:${PORT}`));
});
`);

// public/index.html
writeFile('public/index.html', `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NEXUS OS | Local System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Cairo', sans-serif; background-color: #0f172a; color: #e2e8f0; } .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); }</style>
</head>
<body class="h-screen flex overflow-hidden">
    <aside class="w-64 glass border-l border-slate-700 flex flex-col">
        <div class="p-6 text-center border-b border-slate-700"><h1 class="text-2xl font-bold text-cyan-400">🧠 NEXUS OS</h1><p class="text-xs text-slate-400 mt-1">Local System v2.0</p></div>
        <nav class="flex-1 p-4 space-y-2">
            <button onclick="loadTab('dashboard')" id="nav-dashboard" class="nav-btn active w-full text-right px-4 py-3 rounded hover:bg-slate-700 transition">📊 لوحة القيادة</button>
            <button onclick="loadTab('tasks')" id="nav-tasks" class="nav-btn w-full text-right px-4 py-3 rounded hover:bg-slate-700 transition text-slate-400">✅ إدارة المهام</button>
            <button onclick="loadTab('settings')" id="nav-settings" class="nav-btn w-full text-right px-4 py-3 rounded hover:bg-slate-700 transition text-slate-400">⚙️ الإعدادات</button>
        </nav>
    </aside>
    <main class="flex-1 overflow-y-auto p-8 relative"><div id="content" class="max-w-6xl mx-auto"></div></main>
    <script>
        async function api(endpoint, method = 'GET', body = null) {
            const opts = { method, headers: { 'Content-Type': 'application/json' } };
            if (body) opts.body = JSON.stringify(body);
            const res = await fetch(`/api${endpoint}`, opts);
            return await res.json();
        }
        async function loadTab(tab) {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-cyan-400'));
            document.getElementById('nav-' + tab).classList.add('active', 'text-cyan-400');
            const content = document.getElementById('content');
            content.innerHTML = '<div class="text-center py-20 text-cyan-400 animate-pulse">جاري التحميل...</div>';

            if (tab === 'dashboard') {
                const data = await api('/dashboard');
                content.innerHTML = `
                    <h2 class="text-3xl font-bold mb-6">لوحة القيادة التكتيكية</h2>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div class="glass p-6 rounded-xl"><p class="text-slate-400">إجمالي المهام</p><p class="text-3xl font-bold mt-2">${data.stats.total}</p></div>
                        <div class="glass p-6 rounded-xl border-r-4 ${data.stats.late > 0 ? 'border-red-500' : 'border-green-500'}"><p class="text-slate-400">مهام متأخرة</p><p class="text-3xl font-bold mt-2">${data.stats.late}</p></div>
                        <div class="glass p-6 rounded-xl"><p class="text-slate-400">قيد التنفيذ</p><p class="text-3xl font-bold mt-2">${data.stats.active}</p></div>
                        <div class="glass p-6 rounded-xl"><p class="text-slate-400">الإيرادات</p><p class="text-3xl font-bold mt-2 text-yellow-400">${(data.stats.revenue/1000).toFixed(0)}K</p></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div class="glass p-6 rounded-xl"><h3 class="font-bold mb-4 flex items-center gap-2"><span class="text-xl">📢</span> تنبيهات فورية</h3><div class="space-y-3">${data.alerts.map(a => `<div class='rounded flex gap-3 items-center p-4 bg-slate-900/60'><span>${a.icon}</span><div><div class='font-bold'>${a.title}</div><div class='text-slate-400 text-xs'>${a.time}</div></div></div>`).join('')}</div></div>
                        <div class="glass p-6 rounded-xl"><h3 class="font-bold mb-4">⚡ حالة الفوضى</h3><div class="flex items-center gap-4"><span class="px-4 py-2 rounded text-lg" style="background:${data.chaos.color};color:#fff;">${data.chaos.level}</span></div></div>
                    </div>
                `;
            }
            // بقية التبويبات حسب الحاجة
        }
        loadTab('dashboard');
    </script>
</body>
</html>
`);

console.log('🎉 تم تجهيز مشروع NexusOS بنجاح.');
console.log('📂 اذهب إلى NexusOS/ ثم شغل: npm install ثم node server.js');
