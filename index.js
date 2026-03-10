const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// --- CONFIGURACIÓN DE CARPETAS ---
if (!fs.existsSync('./public/uploads')) {
    fs.mkdirSync('./public/uploads', { recursive: true });
}

// --- CONEXIÓN A BASE DE DATOS ---
const db = new sqlite3.Database('./petshop.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        apellido TEXT,
        telefono TEXT,
        puntos INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mascotas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_mascota TEXT,
        especie TEXT,
        foto TEXT,
        cliente_id INTEGER,
        FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        rol TEXT
    )`);

    db.get("SELECT count(*) as count FROM usuarios", (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO usuarios (username, password, rol) VALUES ('admin', 'admin123', 'desarrollador')");
            db.run("INSERT INTO usuarios (username, password, rol) VALUES ('dueno', 'manada2026', 'usuario')");
        }
    });
});

// --- MIDDLEWARES ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'token-manada-2026',
    resave: false,
    saveUninitialized: true
}));

const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

function requiereLogin(req, res, next) {
    if (req.session.logueado) next();
    else res.redirect('/login');
}

html += `</tbody></table></div></div></div></div></body></html>`;
        res.send(html);
    }); // <--- Esta llave cierra el db.all
}); // <--- Esta llave cierra el app.get('/')

// --- RUTAS DE ACCIÓN ---
app.post('/agregar', requiereLogin, (req, res) => {
    const { nombre, apellido, telefono } = req.body;
    db.run("INSERT INTO clientes (nombre, apellido, telefono) VALUES (?,?,?)", [nombre, apellido, telefono], () => res.redirect('/'));
});

app.post('/sumar-punto', requiereLogin, (req, res) => {
    db.run("UPDATE clientes SET puntos = puntos + 1 WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.post('/agregar-mascota', requiereLogin, upload.single('foto'), (req, res) => {
    const { cliente_id, nombre_mascota } = req.body;
    const foto = req.file ? req.file.filename : '';
    db.run("INSERT INTO mascotas (nombre_mascota, cliente_id, foto) VALUES (?,?,?)", [nombre_mascota, cliente_id, foto], () => res.redirect('/'));
});

app.get('/descargar-datos', requiereLogin, (req, res) => {
    db.all("SELECT * FROM clientes", [], (err, filas) => {
        let csv = "ID,Nombre,Apellido,Puntos\n";
        filas.forEach(f => { csv += `${f.id},${f.nombre},${f.apellido},${f.puntos}\n`; });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=club_manada_backup.csv');
        res.send(csv);
    });
});

app.get('/eliminar/:id', requiereLogin, (req, res) => {
    if (req.session.rol !== 'desarrollador') return res.redirect('/');
    db.run("DELETE FROM mascotas WHERE cliente_id = ?", [req.params.id], () => {
        db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], () => res.redirect('/'));
    });
});

app.listen(port, () => console.log(`El Club de la Manada funcionando en puerto ${port}`));
