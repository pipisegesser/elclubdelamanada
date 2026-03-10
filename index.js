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

// --- LOGIN ---
app.get('/login', (req, res) => {
    res.send(`
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body { background: #FFAA00; background: linear-gradient(135deg, #FFAA00 0%, #FFD600 100%); height: 100vh; display: flex; align-items: center; font-family: 'Arial Black', sans-serif; }
            .card { border: 4px solid #000; border-radius: 25px; box-shadow: 10px 10px 0px #000; }
            .btn-primary { background: #000; border: none; color: #FFAA00; font-weight: bold; border-radius: 15px; }
        </style>
        <div class="container text-center">
            <div class="card mx-auto" style="max-width: 400px;">
                <div class="card-body p-5">
                    <img src="/portada.jpeg" class="img-fluid mb-4 rounded shadow-sm" style="border: 2px solid #000">
                    <h2 class="mb-4">LOGIN</h2>
                    <form action="/login" method="POST">
                        <input type="text" name="usuario" class="form-control mb-3" placeholder="Usuario" required>
                        <input type="password" name="password" class="form-control mb-4" placeholder="Contraseña" required>
                        <button class="btn btn-primary w-100 py-2">ENTRAR</button>
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
            <title>El Club de la Manada</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
            <style>
                body { background: #FFD600; color: #000; }
                .navbar { background: #FFAA00; border-bottom: 4px solid #000; padding: 15px; }
                .card { border: 3px solid #000; border-radius: 20px; box-shadow: 5px 5px 0px #000; }
                .badge-puntos { background: #000; color: #FFAA00; font-size: 1rem; padding: 8px 15px; border-radius: 50px; }
                .puntos-oro { background: #d94300; color: #fff; animation: pulse 1s infinite; }
                @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
                .img-mascota { width: 45px; height: 45px; object-fit: cover; border: 2px solid #000; border-radius: 50%; }
            </style>
        </head>
        <body>
            <nav class="navbar mb-4">
                <div class="container d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <img src="/portada.jpeg" height="50" class="me-3 rounded shadow-sm" style="border: 2px solid #000">
                        <h4 class="fw-bold m-0">EL CLUB DE LA MANADA</h4>
                    </div>
                    <div>
                        <a href="/descargar-datos" class="btn btn-sm btn-dark me-2">Backup</a>
                        <a href="/logout" class="btn btn-sm btn-outline-dark">Salir</a>
                    </div>
                </div>
            </nav>

            <div class="container">
                <div class="row">
                    <div class="col-md-4">
                        <div class="card mb-4">
                            <div class="card-body">
                                <h5 class="fw-bold">Nuevo Dueño</h5>
                                <form action="/agregar" method="POST">
                                    <input type="text" name="nombre" class="form-control mb-2" placeholder="Nombre" required>
                                    <input type="text" name="apellido" class="form-control mb-2" placeholder="Apellido" required>
                                    <button class="btn btn-dark w-100 mt-2">REGISTRAR</button>
                                </form>
                            </div>
                        </div>
                        <form method="GET" action="/" class="input-group mb-4">
                            <input type="text" name="buscar" class="form-control" placeholder="Buscar..." value="${busqueda}">
                            <button class="btn btn-dark"><i class="bi bi-search"></i></button>
                        </form>
                    </div>

                    <div class="col-md-8">
                        <div class="bg-white p-3 rounded shadow border border-dark">
                            <table class="table align-middle">
                                <thead>
                                    <tr>
                                        <th>CLIENTE</th>
                                        <th>MASCOTAS</th>
                                        <th>ACCIÓN</th>
                                    </tr>
                                </thead>
                                <tbody>`;

        if (filas) {
            filas.forEach(f => {
                html += `
                <tr>
                    <td>
                        <div class="fw-bold text-uppercase">${f.nombre} ${f.apellido}</div>
                        <div class="mt-2">
                            <span class="badge badge-puntos ${f.puntos >= 10 ? 'puntos-oro' : ''}">
                                <i class="bi bi-star-fill"></i> ${f.puntos || 0}
                            </span>
                            <form action="/sumar-punto" method="POST" class="d-inline ms-1">
                                <input type="hidden" name="id" value="${f.id}">
                                <button class="btn btn-sm btn-success rounded-circle py-0">+</button>
                            </form>
                        </div>
                    </td>
                    <td>
                        <div class="d-flex flex-wrap gap-2 mb-2">
                            ${f.lista_m ? f.lista_m.split(',').map(m => {
                                const [n, foto] = m.split('|');
                                return `<div class="text-center">
                                            <img src="/uploads/${foto || 'default.png'}" class="img-mascota">
                                            <div style="font-size: 9px; font-weight: bold">${n}</div>
                                        </div>`;
                            }).join('') : '<small class="text-muted">Sin mascotas</small>'}
                        </div>
                        <form action="/agregar-mascota" method="POST" enctype="multipart/form-data" class="row g-1">
                            <input type="hidden" name="cliente_id" value="${f.id}">
                            <div class="col-8"><input type="text" name="nombre_mascota" class="form-control form-control-sm" placeholder="Nueva mascota"></div>
                            <div class="col-4"><button class="btn btn-sm btn-dark w-100">+</button></div>
                        </form>
                    </td>
                    <td>
                        ${req.session.rol === 'desarrollador' ? `<a href="/eliminar/${f.id}" class="btn btn-sm btn-link text-danger" onclick="return confirm('¿Borrar?')"><i class="bi bi-trash"></i></a>` : ''}
                    </td>
                </tr>`;
            });
        }

        html += `</tbody></table></div></div></div></div></body></html>`;
        res.send(html);
    });
});

// --- ACCIONES ---
app.post('/agregar', requiereLogin, (req, res) => {
    db.run("INSERT INTO clientes (nombre, apellido) VALUES (?,?)", [req.body.nombre, req.body.apellido], () => res.redirect('/'));
});

app.post('/sumar-punto', requiereLogin, (req, res) => {
    db.run("UPDATE clientes SET puntos = puntos + 1 WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.post('/agregar-mascota', requiereLogin, upload.single('foto'), (req, res) => {
    const foto = req.file ? req.file.filename : '';
    db.run("INSERT INTO mascotas (nombre_mascota, cliente_id, foto) VALUES (?,?,?)", [req.body.nombre_mascota, req.body.cliente_id, foto], () => res.redirect('/'));
});

app.get('/descargar-datos', requiereLogin, (req, res) => {
    db.all("SELECT * FROM clientes", [], (err, filas) => {
        let csv = "ID,Nombre,Apellido,Puntos\n";
        if (filas) filas.forEach(f => { csv += `${f.id},${f.nombre},${f.apellido},${f.puntos}\n`; });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=backup_manada.csv');
        res.send(csv);
    });
});

app.get('/eliminar/:id', requiereLogin, (req, res) => {
    if (req.session.rol !== 'desarrollador') return res.redirect('/');
    db.run("DELETE FROM mascotas WHERE cliente_id = ?", [req.params.id], () => {
        db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], () => res.redirect('/'));
    });
});

app.listen(port, () => console.log(`Servidor Manada listo!`));

