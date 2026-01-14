const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const session = require('express-session');

// Database ciwai.db
const db = new sqlite3.Database('./data/ciwai.db');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup Session
app.use(session({
  secret: 'kunci-rahasia-ciwai',
  resave: false,
  saveUninitialized: true
}));

// Fungsi (Middleware)
const auth = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/login');
};

app.use(express.static('public'));

// --- ROUTES HALAMAN (VIEW) ---

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/daftar-page', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/daftar.html'));
});

// --- LOGIKA LOGIN/LOGOUT ---

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (err || !user) return res.send("Salah bro!");
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.redirect('/admin/dashboard');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// --- LOGIKA DATABASE (API) ---

app.post('/daftar', (req, res) => {
  const { name, email, phone, program } = req.body;
  const sql = `INSERT INTO registrations (name, email, phone, program, status) VALUES (?, ?, ?, ?, 'pending')`;
  db.run(sql, [name, email, phone, program], function (err) {
    if (err) return res.send("Gagal daftar: " + err.message);
    res.send("<h2>Pendaftaran Berhasil!</h2><a href='/'>Balik ke Depan</a>");
  });
});

app.get('/admin/dashboard', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/api/registrations', auth, (req, res) => {
  db.all("SELECT * FROM registrations ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(3001, () => {
  console.log('Server PKBM Sat-Set jalan di port 3001 🚀');
});