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

// --- RUTAS DE ACCESO ---
app.get('/login', (req, res) => {
    res.send(`
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body { background: #FFAA00; background: linear-gradient(135deg, #FFAA00 0%, #FFD600 100%); height: 100vh; display: flex; align-items: center; font-family: 'Arial Black', sans-serif; }
            .card { border: 4px solid #000; border-radius: 25px; box-shadow: 10px 10px 0px #000; }
            .btn-primary { background: #000; border: none; color: #FFAA00; font-weight: bold; border-radius: 15px; }
            .btn-primary:hover { background: #333; color: #fff; }
        </style>
        <div class="container">
            <div class="card mx-auto" style="max-width: 400px;">
                <div class="card-body text-center p-5">
                    <img src="/portada.jpg" class="img-fluid mb-4 rounded shadow-sm" style="border: 2px solid #000">
                    <h2 class="mb-4">LOGIN</h2>
                    <form action="/login" method="POST">
                        <input type="text" name="usuario" class="form-control mb-3" placeholder="Usuario" required>
                        <input type="password" name="password" class="form-control mb-4" placeholder="Contraseña" required>
                        <button class="btn btn-primary w-100 py-2">ENTRAR A LA MANADA</button>
                    </form>
                </div>
            </div>
        </div>
    `);
});

app.post('/login', (req, res) => {
    const { usuario, password } = req.body;
    db.get("SELECT * FROM usuarios WHERE username = ? AND password = ?", [usuario, password], (err, user) => {
        if (user) {
            req.session.logueado = true;
            req.session.rol = user.rol;
            res.redirect('/');
        } else {
            res.send('Acceso denegado. <a href="/login">Volver</a>');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- PANEL PRINCIPAL ---
app.get('/', requiereLogin, (req, res) => {
    const busqueda = req.query.buscar || '';
    const query = `
        SELECT c.*, GROUP_CONCAT(m.nombre_mascota || '|' || COALESCE(m.foto,'')) as lista_m
        FROM clientes c
        LEFT JOIN mascotas m ON c.id = m.cliente_id
        WHERE c.nombre LIKE ? OR c.apellido LIKE ?
        GROUP BY c.id
    `;

    db.all(query, [`%${busqueda}%`, `%${busqueda}%`], (err, filas) => {
        let html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>El Club de la Manada - Admin</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="
