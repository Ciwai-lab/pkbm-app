const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const app = express();

// 1. CONFIG & DATABASE
const db = new sqlite3.Database('./data/ciwai.db');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public')); // Asset static (CSS, JS, Images)

app.use(session({
  secret: 'kunci-rahasia-ciwai',
  resave: false,
  saveUninitialized: true
}));

// 2. MIDDLEWARE (SATUR SECURITY)
const isAdmin = (req, res, next) => {
  if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'tutor')) return next();
  res.redirect('/login');
};

const isSiswa = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'siswa') return next();
  res.redirect('/login');
};

// 3. ROUTES: VIEW (HALAMAN HTML)
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect(req.session.user.role === 'siswa' ? '/dashboard' : '/admin/dashboard');
  res.sendFile(path.join(__dirname, 'public/home.html'));
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/daftar-page', (req, res) => res.sendFile(path.join(__dirname, 'public/daftar.html')));
app.get('/sukses', (req, res) => res.sendFile(path.join(__dirname, 'public/sukses.html')));

// --- Halaman Khusus Siswa ---
app.get('/dashboard', isSiswa, (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/ruang-belajar', isSiswa, (req, res) => res.sendFile(path.join(__dirname, 'public/belajar.html')));
app.get('/ruang-ujian-list', isSiswa, (req, res) => res.sendFile(path.join(__dirname, 'public/ruang_ujian_mapel.html')));
app.get('/forum', isSiswa, (req, res) => res.sendFile(path.join(__dirname, 'public/forum.html')));

// --- Halaman Khusus Admin ---
app.get('/admin/dashboard', isAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));


// 4. ROUTES: API (LOGIKA & DATA)
// --- Auth API ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Cek Admin/Tutor
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (user) {
      req.session.user = { id: user.id, username: user.username, role: user.role };
      return res.redirect('/admin/dashboard');
    }
    // Cek Siswa
    db.get(`SELECT * FROM registrations WHERE reg_number = ? AND (password = ? OR (password IS NULL AND reg_number = ?)) AND status = 'approved'`,
      [username, password, password], (err, siswa) => {
        if (err || !siswa) return res.send("<script>alert('Login Gagal!'); window.location='/login';</script>");
        req.session.user = { id: siswa.id, name: siswa.name, role: 'siswa', reg_number: siswa.reg_number, program: siswa.program };
        res.redirect('/dashboard');
      });
  });
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
app.get('/api/user-info', (req, res) => res.json(req.session.user || { error: "Not Login" }));

// --- Forum Diskusi API ---
app.get('/api/discussions', isSiswa, (req, res) => {
  db.all(`SELECT * FROM discussions WHERE program = ? ORDER BY timestamp DESC LIMIT 50`, [req.session.user.program], (err, rows) => res.json(rows));
});

app.post('/api/discussions', isSiswa, (req, res) => {
  const { message } = req.body;
  const { id, name, program } = req.session.user;
  db.run(`INSERT INTO discussions (user_id, username, program, message) VALUES (?, ?, ?, ?)`,
    [id, name, program, message], () => res.json({ status: 'success' }));
});

// --- Pendaftaran & Admin API ---
app.post('/daftar', (req, res) => {
  const { name, phone, program, ...rest } = req.body;
  db.run(`INSERT INTO registrations (name, phone, program, status, address) VALUES (?, ?, ?, 'pending', ?)`, [name, phone, program, JSON.stringify(rest)], function () {
    const regNumber = `REG${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${this.lastID.toString().padStart(3, '0')}`;
    db.run("UPDATE registrations SET reg_number = ? WHERE id = ?", [regNumber, this.lastID], () => res.json({ success: true, reg_number: regNumber }));
  });
});

app.get('/api/registrations', isAdmin, (req, res) => {
  db.all("SELECT * FROM registrations ORDER BY id DESC", (err, rows) => res.json(rows));
});

app.post('/api/update-password', (req, res) => {
  const { newPassword } = req.body;
  const sql = (req.session.user.role === 'siswa')
    ? "UPDATE registrations SET password = ? WHERE id = ?"
    : "UPDATE users SET password = ? WHERE id = ?";

  db.run(sql, [newPassword, req.session.user.id], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal update password bro!" });

    res.json({ success: true, message: "Password berhasil diupdate!" });
  });
});

// 5. LISTEN
app.listen(3001, () => console.log('Server PKBM Sat-Set jalan di port 3001 🚀'));