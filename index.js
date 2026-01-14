const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

// middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

// database
const dbPath = path.join(__dirname, 'data', 'ciwai.db');
const db = new sqlite3.Database(dbPath);

// routes
app.get('/', (req, res) => {
  res.send('PKBM App is alive 🚀');
});

// FORM PENDAFTARAN
app.get('/daftar', (req, res) => {
  res.send(`
    <h2>Form Pendaftaran PKBM</h2>
    <form method="POST" action="/daftar">
      <label>Nama Lengkap</label><br/>
      <input name="full_name" required /><br/><br/>

      <label>Email</label><br/>
      <input name="email" type="email" required /><br/><br/>

      <label>No. HP</label><br/>
      <input name="phone" /><br/><br/>

      <label>Alamat</label><br/>
      <textarea name="address"></textarea><br/><br/>

      <button type="submit">Daftar</button>
    </form>
  `);
});

// HANDLE SUBMIT
app.post('/daftar', (req, res) => {
  const { full_name, email, phone, address } = req.body;

  const sql = `
    INSERT INTO registrations (full_name, email, phone, address)
    VALUES (?, ?, ?, ?)
  `;

  db.run(sql, [full_name, email, phone, address], function (err) {
    if (err) {
      console.error(err);
      return res.send('Terjadi kesalahan.');
    }

    res.send(`
      <h3>Pendaftaran berhasil 🎉</h3>
      <p>Data kamu sudah kami terima.</p>
      <p>Silakan tunggu konfirmasi dari admin PKBM.</p>
    `);
  });
});

app.listen(PORT, () => {
  console.log(`PKBM app running on port ${PORT}`);
});

