const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000; // Importante para Render

// --- CONFIGURACIÓN DE CARPETAS ---
if (!fs.existsSync('./public/uploads')) {
    fs.mkdirSync('./public/uploads', { recursive: true });
}

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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'clave-secreta-manada',
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

// --- VISTAS ---

app.get('/login', (req, res) => {
    res.send(`
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <body class="bg-primary d-flex align-items-center vh-100">
            <div class="card mx-auto shadow-lg border-0" style="width: 380px; border-radius: 20px;">
                <div class="card-body text-center p-5">
                    <h2 class="fw-bold mb-4">🐾 El Club de la Manada</h2>
                    <form action="/login" method="POST">
                        <input type="text" name="usuario" class="form-control mb-3" placeholder="Usuario" required>
                        <input type="password" name="password" class="form-control mb-4" placeholder="Contraseña" required>
                        <button class="btn btn-primary w-100 rounded-pill py-2 fw-bold">ENTRAR A LA MANADA</button>
                    </form>
                </div>
            </div>
        </body>
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
            res.send('Acceso fallido. <a href="/login">Volver a intentar</a>');
        }
    });
});

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
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
            <style>
                .puntos-card { transition: all 0.3s; }
                .puntos-card:hover { transform: scale(1.05); }
                .btn-add { border-radius: 50px; }
            </style>
        </head>
        <body class="bg-light">
            <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
                <div class="container">
                    <a class="navbar-brand fw-bold" href="/"><i class="bi bi-dog"></i> EL CLUB DE LA MANADA</a>
                    <div class="d-flex align-items-center">
                        <span class="text-white-50 me-3 small">Hola, ${req.session.rol}</span>
                        <a href="/logout" class="btn btn-outline-light btn-sm rounded-pill">Salir</a>
                    </div>
                </div>
            </nav>

            <div class="container mt-4">
                <div class="row">
                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm mb-4">
                            <div class="card-body">
                                <h5 class="fw-bold mb-3">Nuevo Integrante</h5>
                                <form action="/agregar" method="POST">
                                    <input type="text" name="nombre" class="form-control mb-2" placeholder="Nombre Dueño" required>
                                    <input type="text" name="apellido" class="form-control mb-2" placeholder="Apellido" required>
                                    <button class="btn btn-primary w-100 fw-bold">UNIR A LA MANADA</button>
                                </form>
                            </div>
                        </div>
                        <form method="GET" action="/" class="input-group">
                            <input type="text" name="buscar" class="form-control" placeholder="Buscar por apellido..." value="${busqueda}">
                            <button class="btn btn-dark"><i class="bi bi-search"></i></button>
                        </form>
                    </div>

                    <div class="col-lg-8">
                        <div class="table-responsive bg-white rounded shadow-sm p-4">
                            <table class="table align-middle">
                                <thead class="text-muted small uppercase">
                                    <tr>
                                        <th>CLIENTE / PUNTOS</th>
                                        <th>MASCOTAS</th>
                                        <th class="text-end">GESTIÓN</th>
                                    </tr>
                                </thead>
                                <tbody>`;

        filas.forEach(f => {
            html += `
                <tr>
                    <td>
                        <div class="fw-bold fs-5">${f.nombre} ${f.apellido}</div>
                        <div class="d-flex align-items-center mt-1">
                            <span class="badge ${f.puntos >= 10 ? 'bg-danger animate-bounce' : 'bg-warning text-dark'} px-3 rounded-pill">
                                <i class="bi bi-star-fill"></i> ${f.puntos} PUNTOS
                            </span>
                            <form action="/sumar" method="POST" class="ms-2">
                                <input type="hidden" name="id" value="${f.id}">
                                <button class="btn btn-sm btn-success btn-add"><i class="bi bi-plus"></i></button>
                            </form>
                        </div>
                    </td>
                    <td>
                        <div class="d-flex gap-2">
                            ${f.lista_m ? f.lista_m.split(',').map(m => {
                                const [nombre, foto] = m.split('|');
                                return `
                                    <div class="text-center">
                                        <img src="/uploads/${foto || 'default.png'}" class="rounded-circle shadow-sm" style="width:45px; height:45px; object-fit:cover;">
                                        <div class="small fw-bold mt-1" style="font-size: 11px;">${nombre}</div>
                                    </div>`;
                            }).join('') : '<span class="text-muted small italic">Sin mascotas</span>'}
                        </div>
                        <form action="/mascota" method="POST" enctype="multipart/form-data" class="mt-2 row g-1">
                            <input type="hidden" name="cid" value="${f.id}">
                            <div class="col-5"><input type="text" name="nm" class="form-control form-control-sm" placeholder="Mascota" required></div>
                            <div class="col-5"><input type="file" name="ft" class="form-control form-control-sm"></div>
                            <div class="col-2"><button class="btn btn-sm btn-dark w-100">+</button></div>
                        </form>
                    </td>
                    <td class="text-end">
                        ${req.session.rol === 'desarrollador' ? `<a href="/borrar/${f.id}" class="btn btn-link text-danger p-0" onclick="return confirm('¿Eliminar de la manada?')"><i class="bi bi-trash"></i></a>` : ''}
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div></div></div></div></body></html>`;
        res.send(html);
    });
});

// --- LÓGICA DE DATOS ---

app.post('/agregar', requiereLogin, (req, res) => {
    db.run("INSERT INTO clientes (nombre, apellido) VALUES (?,?)", [req.body.nombre, req.body.apellido], () => res.redirect('/'));
});

app.post('/sumar', requiereLogin, (req, res) => {
    db.run("UPDATE clientes SET puntos = puntos + 1 WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.post('/mascota', requiereLogin, upload.single('ft'), (req, res) => {
    const foto = req.file ? req.file.filename : '';
    db.run("INSERT INTO mascotas (nombre_mascota, cliente_id, foto) VALUES (?,?,?)", [req.body.nm, req.body.cid, foto], () => res.redirect('/'));
});

app.get('/borrar/:id', requiereLogin, (req, res) => {
    if (req.session.rol !== 'desarrollador') return res.redirect('/');
    db.run("DELETE FROM mascotas WHERE cliente_id = ?", [req.params.id], () => {
        db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], () => res.redirect('/'));
    });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });


app.listen(port, () => console.log("El Club de la Manada Online en puerto " + port));

// --- RUTA DE BACKUP (DESCARGAR EXCEL/CSV) ---
app.get('/descargar-datos', requiereLogin, (req, res) => {
    db.all("SELECT id, nombre, apellido, puntos FROM clientes", [], (err, filas) => {
        if (err) return res.status(500).send("Error");

        // Encabezados del CSV
        let csv = "ID,Nombre,Apellido,Puntos\n";
        
        // Unimos los datos
        filas.forEach(f => {
            csv += `${f.id},${f.nombre},${f.apellido},${f.puntos}\n`;
        });

        // Configuración para que el navegador lo descargue
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=respaldo_manada.csv');
        res.status(200).send(csv);
    });
});
