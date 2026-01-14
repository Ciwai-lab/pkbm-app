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
  const { name, phone, program, ...rest } = req.body;
  const detailData = JSON.stringify(rest);

  // STEP 1: Masukin data utama dulu
  const sql = `INSERT INTO registrations (name, phone, program, status, address) VALUES (?, ?, ?, 'pending', ?)`;

  db.run(sql, [name, phone, program, detailData], function (err) {
    if (err) {
      console.error("Gagal Simpan:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }

    // STEP 2: Ambil ID yang baru masuk (lastID)
    const d = new Date();
    const dateStr = d.getFullYear().toString() +
      (d.getMonth() + 1).toString().padStart(2, '0') +
      d.getDate().toString().padStart(2, '0');

    // Format rapet buat Barcode: REG20260114001
    const regNumber = `REG${dateStr}${this.lastID.toString().padStart(3, '0')}`;

    // STEP 3: Update nomor registrasinya
    db.run("UPDATE registrations SET reg_number = ? WHERE id = ?", [regNumber, this.lastID], (updateErr) => {
      if (updateErr) {
        console.error("Gagal Update No Reg:", updateErr.message);
        return res.status(500).json({ success: false, error: "Gagal bikin Nomor Registrasi" });
      }

      // STEP 4: Kirim respon sukses beneran
      res.status(200).json({
        success: true,
        reg_number: regNumber
      });
    });
  });
});

// --- ROUTES ADMIN & LAINNYA ---

app.get('/admin/dashboard', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/api/registrations', (req, res) => {
  db.all("SELECT * FROM registrations ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // Gabungin data utama dengan data di dalam JSON address
    const dataLengkap = rows.map(row => {
      try {
        const extra = JSON.parse(row.address);
        return { ...row, ...extra };
      } catch (e) { return row; }
    });
    res.json(dataLengkap);
  });
});

app.post('/api/approve/:id', auth, (req, res) => {
  const id = req.params.id;
  const d = new Date();
  const dateStr = d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getDate().toString().padStart(2, '0');

  // Format rapet: REG + TANGGAL + ID
  const regNumber = `REG${dateStr}${id.padStart(3, '0')}`;

  db.run("UPDATE registrations SET status = 'approved', reg_number = ? WHERE id = ?",
    [regNumber, id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, reg_number: regNumber });
    });
});

app.get('/sukses', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/sukses.html'));
});

// app.listen
app.listen(3001, () => {
  console.log('Server PKBM Sat-Set jalan di port 3001 🚀');
});