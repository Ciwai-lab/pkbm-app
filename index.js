const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const session = require('express-session');

// Database ciwai.db di folder data ente
const db = new sqlite3.Database('./data/ciwai.db');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup Session
app.use(session({
  secret: 'kunci-rahasia-ciwai', // Ganti sesuka ente bro
  resave: false,
  saveUninitialized: true
}));

// Fungsi "Satpam" (Middleware)
const auth = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/login');
};

app.get('/', (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PKBM Ciwai - Pendaftaran Online</title>
            <style>
                body { font-family: sans-serif; background: #f4f4f4; text-align: center; padding: 50px; }
                .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); display: inline-block; width: 100%; max-width: 400px; }
                input, select { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 5px; }
                button { width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
                button:hover { background: #218838; }
                .login-link { margin-top: 20px; display: block; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Pendaftaran Siswa Baru</h2>
                <p>PKBM Ciwai - Masa Depan Lebih Cerah</p>
                <form action="/daftar" method="POST">
                    <input type="text" name="name" placeholder="Nama Lengkap" required>
                    <input type="email" name="email" placeholder="Email Aktif" required>
                    <input type="text" name="phone" placeholder="Nomor WhatsApp" required>
                    <select name="program">
                        <option value="Paket A">Paket A (SD)</option>
                        <option value="Paket B">Paket B (SMP)</option>
                        <option value="Paket C" selected>Paket C (SMA)</option>
                    </select>
                    <button type="submit">Daftar Sekarang</button>
                </form>
                <a href="/login" class="login-link">Portal Admin / Mentor</a>
            </div>
        </body>
        </html>
    `);
});

// 1. Route Halaman Login
app.get('/login', (req, res) => {
  res.send(`
        <h2>Login PKBM</h2>
        <form action="/login" method="POST">
            <input name="username" placeholder="Username" required><br>
            <input name="password" type="password" placeholder="Password" required><br>
            <button type="submit">Masuk</button>
        </form>
    `);
});

// 2. Proses Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (err || !user) return res.send("Salah bro!");

    // Simpen data user ke session
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.redirect('/admin/dashboard');
  });
});

// 1. Route Dashboard Admin (Sat-set buat liat data)
app.get('/admin/dashboard', auth, (req, res) => {
  db.all("SELECT * FROM registrations ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).send("Database Error");

    // Kirim HTML sederhana biar mual ente ilang liat datanya
    let html = `<h1>Admin Dashboard PKBM</h1>
            <p>Halo, <b>${req.session.user.username}</b>! | <a href="/logout" style="color:red">Logout</a></p>
            <hr>
            <a href="/admin/tambah-offline"> + Tambah Siswa Manual</a>
                    <table border="1" cellpadding="10">
                        <tr>
                            <th>Nama</th><th>Email</th><th>HP</th><th>Alamat</th><th>Status</th><th>Aksi</th>
                        </tr>`;
    rows.forEach(row => {
      const namaSiswa = row.name || row.fullname || "Tanpa Nama";
      html += `<tr>
        <td>${namaSiswa}</td>
        <td>${row.email}</td>
        <td>${row.phone}</td>
        <td>${row.address}</td>
        <td><span style="color: orange">${row.status}</span></td>
        <td>
            <a href="/admin/edit/${row.id}">📝 Edit</a> | 
            <a href="/admin/hapus/${row.id}" style="color:red">🗑️ Hapus</a>
        </td>
    </tr>`;
    });
    html += `</table>`;
    res.send(html);
  });
});

app.get('/admin/edit/:id', (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM registrations WHERE id = ?", [id], (err, row) => {
    if (err || !row) return res.send("Data tidak ditemukan");
    res.send(`
            <h3>Edit Data: ${row.name}</h3>
            <form action="/admin/update/${id}" method="POST">
                Status: 
                <select name="status">
                    <option value="pending" ${row.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="aktif" ${row.status === 'aktif' ? 'selected' : ''}>Aktif/Diterima</option>
                    <option value="ditolak" ${row.status === 'ditolak' ? 'selected' : ''}>Ditolak</option>
                </select><br><br>
                <button type="submit">Update Status</button>
            </form>
        `);
  });
});

// 2. Input Manual/Offline
app.get('/admin/tambah-offline', (req, res) => {
  res.send(`
        <h3>Input Pendaftar Offline</h3>
        <form action="/daftar" method="POST">
            <input name="name" placeholder="Nama Lengkap" required><br>
            <input name="email" placeholder="Email"><br>
            <input name="phone" placeholder="No HP"><br>
            <textarea name="address" placeholder="Alamat"></textarea><br>
            <button type="submit">Simpan Data Offline</button>
        </form>
    `);
});

// Route buat Logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send("Gagal logout bro, coba lagi!");
    }
    res.redirect('/login'); // Balikin ke halaman login
  });
});

// Port 3001 sesuai setup ente di localhost tadi
app.listen(3001, () => {
  console.log('Server PKBM Sat-Set jalan di port 3001 🚀');
});