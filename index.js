const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

if (!fs.existsSync('./public/uploads')) {
    fs.mkdirSync('./public/uploads', { recursive: true });
}

// Reset V6 para incluir todas las funciones
const db = new sqlite3.Database('./manada_v6.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT, apellido TEXT, telefono TEXT, direccion TEXT, puntos INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS mascotas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_mascota TEXT, tipo TEXT, cumple TEXT, info TEXT, foto TEXT, cliente_id INTEGER,
        FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, rol TEXT
    )`);
    db.get("SELECT count(*) as count FROM usuarios", (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO usuarios (username, password, rol) VALUES ('dueno', 'manada2026', 'usuario')");
        }
    });
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: 'manada-v6-final', resave: false, saveUninitialized: true }));

const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

function requiereLogin(req, res, next) {
    if (req.session.logueado) next(); else res.redirect('/login');
}

// --- VISTAS ---

app.get('/login', (req, res) => {
    res.send(`
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <body style="background:#FFAA00; height:100vh; display:flex; align-items:center; font-family:sans-serif;">
            <div class="container text-center">
                <div class="card mx-auto p-4 shadow-lg border-0" style="max-width:400px; border-radius:25px; border: 4px solid #000 !important;">
                    <img src="/portada.jpg" class="img-fluid mb-4 rounded shadow-sm" style="border: 2px solid #000">
                    <h3 class="fw-bold mb-4 text-dark">CLUB LA MANADA</h3>
                    <form action="/login" method="POST">
                        <input type="text" name="usuario" class="form-control mb-3 border-dark" placeholder="Usuario" required>
                        <input type="password" name="password" class="form-control mb-4 border-dark" placeholder="Contraseña" required>
                        <button class="btn btn-dark w-100 fw-bold py-2">INGRESAR AL PANEL</button>
                    </form>
                </div>
            </div>
        </body>
    `);
});

app.post('/login', (req, res) => {
    const { usuario, password } = req.body;
    db.get("SELECT * FROM usuarios WHERE username=? AND password=?", [usuario, password], (err, user) => {
        if (user) { req.session.logueado = true; res.redirect('/'); }
        else { res.send('Acceso denegado. <a href="/login">Volver</a>'); }
    });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.get('/', requiereLogin, (req, res) => {
    const busqueda = req.query.buscar || '';
    const hoy = new Date().toISOString().slice(5, 10); 

    const query = `
        SELECT c.*, GROUP_CONCAT(m.id || '|' || m.nombre_mascota || '|' || COALESCE(m.foto,'') || '|' || COALESCE(m.tipo,'perro') || '|' || COALESCE(m.cumple,'') || '|' || COALESCE(m.info,'')) as lista_m
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
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
                <style>
                    body { background: #FFD600; }
                    .navbar { background: #FFAA00; border-bottom: 4px solid #000; }
                    .card { border: 3px solid #000; border-radius: 15px; }
                    .img-container { width: 65px; height: 65px; border: 2px solid #000; border-radius: 50%; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; }
                    .img-mascota { width: 100%; height: 100%; object-fit: cover; }
                    .cumple-hoy { border: 4px solid #ff4500; animation: scale 0.8s infinite alternate; }
                    @keyframes scale { from { transform: scale(1); } to { transform: scale(1.1); } }
                </style>
            </head>
            <body>
               <nav class="navbar p-2 mb-4 shadow border-bottom border-dark" style="background: #FFAA00;">
    <div class="container d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center">
            <img src="/portada.jpg" height="60" class="rounded border border-dark me-3">
            <h4 class="fw-bold m-0 text-dark">GESTIÓN MANADA</h4>
        </div>
        <a href="/logout" class="btn btn-sm btn-dark fw-bold">SALIR</a>
    </div>
</nav>
                <div class="container"><div class="row">
                    <div class="col-md-4">
                        <div class="card p-3 mb-4 shadow">
                            <h5 class="fw-bold">Nuevo Dueño</h5>
                            <form action="/agregar" method="POST">
                                <input type="text" name="nombre" class="form-control mb-2" placeholder="Nombre" required>
                                <input type="text" name="apellido" class="form-control mb-2" placeholder="Apellido" required>
                                <input type="text" name="telefono" class="form-control mb-2" placeholder="WhatsApp">
                                <button class="btn btn-dark w-100">REGISTRAR</button>
                            </form>
                        </div>
                        <form method="GET" action="/" class="input-group">
                            <input type="text" name="buscar" class="form-control border-dark" placeholder="Buscar..." value="${busqueda}">
                            <button class="btn btn-dark"><i class="bi bi-search"></i></button>
                        </form>
                    </div>
                    <div class="col-md-8">
                        <div class="bg-white p-3 rounded shadow border border-dark">
                            <table class="table align-middle">
                                <thead><tr><th>DUEÑO</th><th>MASCOTAS</th></tr></thead>
                                <tbody>`;
            if (filas) {
                filas.forEach(f => {
                    html += `<tr>
                        <td>
                            <div class="fw-bold text-uppercase">${f.nombre} ${f.apellido}</div>
                            <div class="badge bg-dark text-warning p-2">⭐ ${f.puntos} pts</div>
                            <form action="/sumar-punto" method="POST" class="d-inline">
                                <input type="hidden" name="id" value="${f.id}"><button class="btn btn-sm btn-success rounded-circle">+</button>
                            </form>
                        </td>
                        <td>
                            <div class="d-flex flex-wrap gap-2 mb-2">
                                ${f.lista_m ? f.lista_m.split(',').map(m => {
                                    const p = m.split('|');
                                    const esCumple = p[4] && p[4].slice(5, 10) === hoy;
                                    let icono = p[3] === 'gato' ? '🐱' : (p[3] === 'otro' ? '🐰' : '🐶');
                                    let displayImg = p[2] ? \`<img src="/uploads/\${p[2]}" class="img-mascota">\` : \`<span style="font-size:30px">\${icono}</span>\`;
                                    
                                    return \`<div class="text-center position-relative">
                                                <div class="img-container \${esCumple ? 'cumple-hoy' : ''}" title="\${p[5]}">\${displayImg}</div>
                                                <div class="small fw-bold \${esCumple ? 'text-danger' : ''}">\${p[1]}</div>
                                                <div class="d-flex justify-content-center gap-1">
                                                    <a href="/editar-mascota/\${p[0]}" class="text-primary small"><i class="bi bi-pencil"></i></a>
                                                    <a href="/eliminar-mascota/\${p[0]}" class="text-danger small" onclick="return confirm('¿Borrar mascota?')"><i class="bi bi-x-circle"></i></a>
                                                </div>
                                            </div>\`;
                                }).join('') : '---'}
                            </div>
                            <form action="/agregar-mascota" method="POST" enctype="multipart/form-data" class="bg-light p-2 rounded border small">
                                <input type="hidden" name="cliente_id" value="${f.id}">
                                <div class="row g-1">
                                    <div class="col-6"><input type="text" name="nombre_m" class="form-control form-control-sm" placeholder="Nombre" required></div>
                                    <div class="col-6"><select name="tipo" class="form-select form-select-sm"><option value="perro">Perro</option><option value="gato">Gato</option><option value="otro">Otro</option></select></div>
                                    <button class="btn btn-sm btn-dark">Añadir Mascota</button>
                                </div>
                            </form>
                        </td>
                    </tr>`;
                });
            }
            html += `</tbody></table></div></div></div></div></body></html>`;
            res.send(html);
        });
    });
});

// --- EDITAR MASCOTA ---
app.get('/editar-mascota/:id', requiereLogin, (req, res) => {
    db.get("SELECT * FROM mascotas WHERE id = ?", [req.params.id], (err, m) => {
        res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <body style="background:#FFAA00; padding:50px;">
                <div class="card mx-auto p-4" style="max-width:400px; border:3px solid #000;">
                    <h4>Editar Mascota</h4>
                    <form action="/editar-mascota/${m.id}" method="POST" enctype="multipart/form-data">
                        <input name="nombre" class="form-control mb-2" value="${m.nombre_mascota}" placeholder="Nombre">
                        <select name="tipo" class="form-select mb-2">
                            <option value="perro" ${m.tipo === 'perro' ? 'selected' : ''}>Perro</option>
                            <option value="gato" ${m.tipo === 'gato' ? 'selected' : ''}>Gato</option>
                            <option value="otro" ${m.tipo === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                        <input type="date" name="cumple" class="form-control mb-2" value="${m.cumple}">
                        <input type="text" name="info" class="form-control mb-2" value="${m.info || ''}" placeholder="Alimento/Notas">
                        <input type="file" name="foto" class="form-control mb-3">
                        <button class="btn btn-dark w-100">GUARDAR CAMBIOS</button>
                        <a href="/" class="btn btn-link w-100 mt-2 text-dark">Cancelar</a>
                    </form>
                </div>
            </body>
        `);
    });
});

app.post('/editar-mascota/:id', requiereLogin, upload.single('foto'), (req, res) => {
    const { nombre, tipo, cumple, info } = req.body;
    if (req.file) {
        db.run("UPDATE mascotas SET nombre_mascota=?, tipo=?, cumple=?, info=?, foto=? WHERE id=?", [nombre, tipo, cumple, info, req.file.filename, req.params.id], () => res.redirect('/'));
    } else {
        db.run("UPDATE mascotas SET nombre_mascota=?, tipo=?, cumple=?, info=? WHERE id=?", [nombre, tipo, cumple, info, req.params.id], () => res.redirect('/'));
    }
});

// --- OTRAS ACCIONES ---
app.post('/agregar', requiereLogin, (req, res) => {
    db.run("INSERT INTO clientes (nombre, apellido, telefono) VALUES (?,?,?)", [req.body.nombre, req.body.apellido, req.body.telefono], () => res.redirect('/'));
});

app.post('/sumar-punto', requiereLogin, (req, res) => {
    db.run("UPDATE clientes SET puntos = puntos + 1 WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.post('/agregar-mascota', requiereLogin, upload.single('foto'), (req, res) => {
    const { cliente_id, nombre_m, tipo } = req.body;
    const foto = req.file ? req.file.filename : '';
    db.run("INSERT INTO mascotas (nombre_mascota, tipo, foto, cliente_id) VALUES (?,?,?,?)", [nombre_m, tipo, foto, cliente_id], () => res.redirect('/'));
});

app.get('/eliminar-mascota/:id', requiereLogin, (req, res) => {
    db.run("DELETE FROM mascotas WHERE id = ?", [req.params.id], () => res.redirect('/'));
});

app.listen(port, () => console.log('¡V6 con edición activa!'));

