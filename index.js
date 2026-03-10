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
        direccion TEXT,
        puntos INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mascotas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_mascota TEXT,
        tipo TEXT,
        cumple_mascota TEXT,
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
                    <h2 class="mb-4">EL CLUB</h2>
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
        SELECT c.*, GROUP_CONCAT(m.id || '|' || m.nombre_mascota || '|' || COALESCE(m.foto,'') || '|' || COALESCE(m.tipo,'perro')) as lista_m
        FROM clientes c
        LEFT JOIN mascotas m ON c.id = m.cliente_id
        WHERE c.nombre LIKE ? OR c.apellido LIKE ? OR m.nombre_mascota LIKE ?
        GROUP BY c.id
    `;

    db.all(query, [`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`], (err, filas) => {
        db.get("SELECT COUNT(*) as total FROM mascotas", (err, stat) => {
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
                    .navbar { background: #FFAA00; border-bottom: 4px solid #000; padding: 10px; }
                    .card { border: 3px solid #000; border-radius: 20px; box-shadow: 5px 5px 0px #000; }
                    .alerta-premio { background: #fff; border: 3px dashed #ff4500; color: #ff4500; font-weight: bold; animation: pulse 1s infinite; padding: 5px; border-radius: 10px; text-align: center; }
                    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
                    .img-mascota { width: 50px; height: 50px; object-fit: cover; border: 2px solid #000; border-radius: 50%; background: #fff; }
                </style>
            </head>
            <body>
                <nav class="navbar mb-4 shadow">
                    <div class="container d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <img src="/portada.jpeg" height="50" class="me-2 rounded border border-dark">
                            <h4 class="fw-bold m-0">MANADA (${stat.total || 0})</h4>
                        </div>
                        <a href="/logout" class="btn btn-sm btn-dark">Salir</a>
                    </div>
                </nav>
                <div class="container">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="card p-3 mb-4">
                                <h5 class="fw-bold">Nuevo Cliente</h5>
                                <form action="/agregar" method="POST">
                                    <input type="text" name="nombre" class="form-control mb-2" placeholder="Nombre" required>
                                    <input type="text" name="apellido" class="form-control mb-2" placeholder="Apellido" required>
                                    <input type="text" name="telefono" class="form-control mb-2" placeholder="Teléfono">
                                    <input type="text" name="direccion" class="form-control mb-2" placeholder="Dirección">
                                    <button class="btn btn-dark w-100">REGISTRAR</button>
                                </form>
                            </div>
                            <form method="GET" action="/" class="input-group mb-4">
                                <input type="text" name="buscar" class="form-control border-dark" placeholder="Dueño o mascota..." value="${busqueda}">
                                <button class="btn btn-dark"><i class="bi bi-search"></i></button>
                            </form>
                        </div>
                        <div class="col-md-8">
                            <div class="bg-white p-3 rounded shadow border border-dark">
                                <table class="table align-middle">
                                    <thead><tr><th>CLIENTE</th><th>MASCOTAS</th><th>ACCIONES</th></tr></thead>
                                    <tbody>`;

            if (filas) {
                filas.forEach(f => {
                    let premio = f.puntos >= 10 ? `<div class="alerta-premio mb-2">🏆 ¡PREMIO PARA ${f.nombre}! 🏆</div>` : '';
                    html += `
                    <tr>
                        <td>
                            ${premio}
                            <div class="fw-bold text-uppercase">${f.nombre} ${f.apellido}</div>
                            <small class="text-muted d-block">${f.telefono || ''}</small>
                            <div class="mt-2 d-flex align-items-center">
                                <span class="badge bg-dark text-warning p-2 me-2">⭐ ${f.puntos} pts</span>
                                <form action="/sumar-punto" method="POST">
                                    <input type="hidden" name="id" value="${f.id}">
                                    <button class="btn btn-sm btn-success rounded-circle">+</button>
                                </form>
                            </div>
                            <a href="/editar-cliente/${f.id}" class="small text-decoration-none text-primary mt-1 d-block">Editar Dueño</a>
                        </td>
                        <td>
                            <div class="d-flex flex-wrap gap-2 mb-2">
                                ${f.lista_m ? f.lista_m.split(',').map(m => {
                                    const [mid, n, foto, tipo] = m.split('|');
                                    let img = foto ? `/uploads/${foto}` : `/uploads/${tipo}.png`;
                                    return `<div class="text-center position-relative">
                                                <img src="${img}" class="img-mascota">
                                                <div style="font-size: 10px;" class="fw-bold">${n}</div>
                                                <a href="/eliminar-mascota/${mid}" class="position-absolute top-0 end-0 badge bg-danger rounded-circle p-1" style="font-size:8px">X</a>
                                            </div>`;
                                }).join('') : '<small>Sin mascotas</small>'}
                            </div>
                            <form action="/agregar-mascota" method="POST" class="row g-1">
                                <input type="hidden" name="cliente_id" value="${f.id}">
                                <div class="col-7"><input type="text" name="nombre_mascota" class="form-control form-control-sm" placeholder="Nombre" required></div>
                                <div class="col-5">
                                    <select name="tipo" class="form-select form-select-sm">
                                        <option value="perro">🐶</option><option value="gato">🐱</option><option value="otro">🐰</option>
                                    </select>
                                </div>
                                <button class="btn btn-sm btn-dark mt-1">Añadir</button>
                            </form>
                        </td>
                        <td>
                            <a href="/eliminar/${f.id}" class="btn btn-sm text-danger" onclick="return confirm('¿Eliminar dueño?')"><i class="bi bi-trash"></i></a>
                        </td>
                    </tr>`;
                });
            }
            html += `</tbody></table></div></div></div></div></body></html>`;
            res.send(html);
        });
    });
});

// --- ACCIONES ---
app.post('/agregar', requiereLogin, (req, res) => {
    const { nombre, apellido, telefono, direccion } = req.body;
    db.run("INSERT INTO clientes (nombre, apellido, telefono, direccion) VALUES (?,?,?,?)", [nombre, apellido, telefono, direccion], () => res.redirect('/'));
});

app.post('/sumar-punto', requiereLogin, (req, res) => {
    db.run("UPDATE clientes SET puntos = puntos + 1 WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.post('/agregar-mascota', requiereLogin, (req, res) => {
    const { cliente_id, nombre_mascota, tipo } = req.body;
    db.run("INSERT INTO mascotas (nombre_mascota, cliente_id, tipo) VALUES (?,?,?)", [nombre_mascota, cliente_id, tipo], () => res.redirect('/'));
});

app.get('/eliminar-mascota/:id', requiereLogin, (req, res) => {
    db.run("DELETE FROM mascotas WHERE id = ?", [req.params.id], () => res.redirect('/'));
});

app.get('/editar-cliente/:id', requiereLogin, (req, res) => {
    db.get("SELECT * FROM clientes WHERE id = ?", [req.params.id], (err, c) => {
        res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <body style="background:#FFAA00" class="p-5">
                <div class="card mx-auto p-4 border-dark" style="max-width:400px; border:3px solid #000; border-radius:20px">
                    <h3>Editar Dueño</h3>
                    <form action="/editar-cliente/${c.id}" method="POST">
                        <input name="nombre" class="form-control mb-2" value="${c.nombre}">
                        <input name="apellido" class="form-control mb-2" value="${c.apellido}">
                        <input name="telefono" class="form-control mb-2" value="${c.telefono || ''}">
                        <input name="direccion" class="form-control mb-3" value="${c.direccion || ''}">
                        <button class="btn btn-dark w-100">GUARDAR</button>
                        <a href="/" class="btn btn-link w-100 mt-2 text-dark">Volver</a>
                    </form>
                </div>
            </body>
        `);
    });
});

app.post('/editar-cliente/:id', requiereLogin, (req, res) => {
    const { nombre, apellido, telefono, direccion } = req.body;
    db.run("UPDATE clientes SET nombre=?, apellido=?, telefono=?, direccion=? WHERE id=?", [nombre, apellido, telefono, direccion, req.params.id], () => res.redirect('/'));
});

app.get('/eliminar/:id', requiereLogin, (req, res) => {
    db.run("DELETE FROM mascotas WHERE cliente_id = ?", [req.params.id], () => {
        db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], () => res.redirect('/'));
    });
});

app.listen(port, () => console.log(`Manada activa en puerto ${port}`));

