const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const app = express();

// 1. CONFIG & DATABASE
const db = new sqlite3.Database('./data/ciwai.db');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: 'kunci-rahasia-ciwai',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// 2. MIDDLEWARE (SATUR SECURITY)
const isAdmin = (req, res, next) => {
  if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'mentor')) return next();
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

// --- Halaman Khusus Admin & Mentor ---
app.get('/admin/dashboard', isAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// 4. ROUTES: API (LOGIKA & DATA)

// --- Auth API ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (user) {
      req.session.user = { id: user.id, username: user.username, role: user.role, full_name: user.full_name, program: user.program };
      return res.redirect('/admin/dashboard');
    }
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

// --- Pendaftaran ---
app.post('/daftar', (req, res) => {
  const { name, phone, program, ...rest } = req.body;
  db.run(`INSERT INTO registrations (name, phone, program, status, address) VALUES (?, ?, ?, 'pending', ?)`, [name, phone, program, JSON.stringify(rest)], function () {
    const regNumber = `REG${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${this.lastID.toString().padStart(3, '0')}`;
    db.run("UPDATE registrations SET reg_number = ? WHERE id = ?", [regNumber, this.lastID], () => res.json({ success: true, reg_number: regNumber }));
  });
});

// --- ADMIN & MENTOR API ---

// 1. Ambil Semua Siswa (Data Induk)
app.get('/api/admin/semua-siswa', isAdmin, (req, res) => {
  db.all("SELECT id, name, reg_number, program, status FROM registrations", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Gagal ambil data induk" });
    res.json(rows);
  });
});

// 2. Ambil Siswa per Paket (Khusus Mentor)
app.get('/api/mentor/siswa', isAdmin, (req, res) => {
  const { role, program } = req.session.user;
  let query = "SELECT id, name, reg_number, program, status FROM registrations";
  let params = [];
  if (role === 'mentor') {
    query += " WHERE program = ? AND status = 'approved'";
    params.push(program);
  }
  db.all(query, params, (err, rows) => res.json(rows));
});

// 3. Detail & Update Siswa
app.get('/api/admin/siswa/:id', isAdmin, (req, res) => {
  db.get("SELECT * FROM registrations WHERE id = ?", [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Siswa gak ketemu" });
    res.json(row);
  });
});

app.post('/api/admin/siswa/update', isAdmin, (req, res) => {
  const { id, name, program } = req.body;
  db.run("UPDATE registrations SET name = ?, program = ? WHERE id = ?", [name, program, id], () => {
    res.json({ message: "Data " + name + " berhasil diperbarui!" });
  });
});

// 4. Hapus Siswa
app.delete('/api/admin/siswa/:id', isAdmin, (req, res) => {
  db.run("DELETE FROM registrations WHERE id = ?", [req.params.id], () => res.json({ message: "Siswa dihapus!" }));
});

// 5. Kelola Tutor
app.get('/api/admin/daftar-tutor', isAdmin, (req, res) => {
  db.all("SELECT id, username, full_name, program FROM users WHERE role IN ('mentor', 'tutor')", [], (err, rows) => res.json(rows));
});

app.post('/api/create-tutor', isAdmin, (req, res) => {
  const { username, password, program, fullName } = req.body;
  db.run(`INSERT INTO users (username, password, role, program, full_name) VALUES (?, ?, 'mentor', ?, ?)`,
    [username, password, program, fullName], () => res.json({ message: 'Tutor berhasil dibuat!' }));
});

app.delete('/api/admin/tutor/:id', isAdmin, (req, res) => {
  db.run("DELETE FROM users WHERE id = ?", [req.params.id], () => res.json({ message: "Tutor dihapus!" }));
});

// --- MATERI & MODUL API ---

app.post('/api/save-material', isAdmin, (req, res) => {
  const { subject, module_link, exam_link } = req.body;
  const { program } = req.session.user;
  db.get("SELECT id FROM materials WHERE program = ? AND subject = ?", [program, subject], (err, row) => {
    if (row) {
      db.run("UPDATE materials SET module_link = ?, exam_link = ? WHERE id = ?", [module_link, exam_link, row.id], () => res.json({ message: "Materi diupdate!" }));
    } else {
      db.run("INSERT INTO materials (program, subject, module_link, exam_link) VALUES (?, ?, ?, ?)", [program, subject, module_link, exam_link], () => res.json({ message: "Materi ditambah!" }));
    }
  });
});

app.get('/api/student/materials', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Login dulu!' });
  const { role, program } = req.session.user;
  let sql = (role === 'admin' || role === 'mentor') ? "SELECT * FROM materials" : "SELECT * FROM materials WHERE program = ?";
  let params = (role === 'admin' || role === 'mentor') ? [] : [program];
  db.all(sql, params, (err, rows) => res.json(rows));
});

app.delete('/api/materials/:id', isAdmin, (req, res) => {
  db.run("DELETE FROM materials WHERE id = ?", [req.params.id], () => res.json({ message: "Materi dihapus!" }));
});

// 5. LISTEN
app.listen(3001, () => console.log('Server PKBM Sat-Set jalan di port 3001 🚀'));