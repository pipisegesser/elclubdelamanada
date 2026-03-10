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

// CAMBIAMOS EL NOMBRE A V4 PARA LIMPIEZA TOTAL
const db = new sqlite3.Database('./manada_v4.db');

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
            db.run("INSERT INTO usuarios (username, password, rol) VALUES ('admin', 'admin123', 'desarrollador')");
            db.run("INSERT INTO usuarios (username, password, rol) VALUES ('dueno', 'manada2026', 'usuario')");
        }
    });
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: 'manada-2026-safe', resave: false, saveUninitialized: true }));

const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

function requiereLogin(req, res, next) {
    if (req.session.logueado) next(); else res.redirect('/login');
}

app.get('/login', (req, res) => {
    res.send(`
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>body{background:#FFAA00; height:100vh; display:flex; align-items:center; font-family:sans-serif;}</style>
        <div class="container text-center"><div class="card mx-auto shadow-lg border-0" style="max-width:350px; border-radius:20px">
            <div class="card-body p-5">
                <img src="/portada.jpeg" class="img-fluid mb-4 rounded border border-dark">
                <h3 class="fw-bold mb-4 text-dark">ENTRAR</h3>
                <form action="/login" method="POST">
                    <input type="text" name="usuario" class="form-control mb-3" placeholder="Usuario" required>
                    <input type="password" name="password" class="form-control mb-4" placeholder="Contraseña" required>
                    <button class="btn btn-dark w-100 fw-bold">INGRESAR</button>
                </form>
            </div>
        </div></div>
    `);
});

app.post('/login', (req, res) => {
    const { usuario, password } = req.body;
    db.get("SELECT * FROM usuarios WHERE username=? AND password=?", [usuario, password], (err, user) => {
        if (user) { 
            req.session.logueado = true; 
            req.session.rol = user.rol; 
            res.redirect('/'); 
        } else { 
            res.send('Usuario o clave incorrectos. <a href="/login">Volver</a>'); 
        }
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
                <title>El Club de la Manada</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
                <style>
                    body { background: #FFD600; font-family: 'Segoe UI', sans-serif; }
                    .navbar { background: #FFAA00; border-bottom: 4px solid #000; }
                    .card { border: 3px solid #000; border-radius: 15px; }
                    .img-mascota { width: 65px; height: 65px; object-fit: cover; border: 2px solid #000; border-radius: 50%; background: #fff; transition: 0.3s; }
                    .img-mascota:hover { transform: scale(1.1); }
                    .cumple-hoy { border: 4px solid #ff4500; animation: scale 0.8s infinite alternate; }
                    @keyframes scale { from { transform: scale(1); } to { transform: scale(1.1); } }
                    .premio-flash { background: #fff; border: 2px dashed #ff4500; font-weight: bold; padding: 5px; border-radius: 10px; color: #ff4500; text-align: center; }
                </style>
            </head>
            <body>
                <nav class="navbar p-2 mb-4 shadow-sm"><div class="container d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <img src="/portada.jpeg" height="50" class="rounded border border-dark me-2"> 
                        <h5 class="m-0 fw-bold text-dark">MANADA: ${stat ? stat.total : 0}</h5>
                    </div>
                    <a href="/logout" class="btn btn-sm btn-dark">Salir</a>
                </div></nav>

                <div class="container"><div class="row">
                    <div class="col-md-4">
                        <div class="card p-3 mb-4 shadow">
                            <h5 class="fw-bold"><i class="bi bi-person-plus"></i> Nuevo Dueño</h5>
                            <form action="/agregar" method="POST">
                                <input type="text" name="nombre" class="form-control mb-2" placeholder="Nombre" required>
                                <input type="text" name="apellido" class="form-control mb-2" placeholder="Apellido" required>
                                <input type="text" name="telefono" class="form-control mb-2" placeholder="WhatsApp (54911...)">
                                <input type="text" name="direccion" class="form-control mb-2" placeholder="Dirección">
                                <button class="btn btn-dark w-100 fw-bold">REGISTRAR</button>
                            </form>
                        </div>
                        <form method="GET" action="/" class="input-group mb-4">
                            <input type="text" name="buscar" class="form-control border-dark shadow-sm" placeholder="Buscar..." value="${busqueda}">
                            <button class="btn btn-dark"><i class="bi bi-search"></i></button>
                        </form>
                    </div>

                    <div class="col-md-8">
                        <div class="bg-white p-3 rounded shadow border border-dark">
                            <table class="table align-middle">
                                <thead class="table-dark"><tr><th>CLIENTE</th><th>MASCOTAS</th><th>ACCIONES</th></tr></thead>
                                <tbody>`;

            if (filas) {
                filas.forEach(f => {
                    let txtPremio = f.puntos >= 10 ? '<div class="premio-flash mb-2">🏆 ¡GANÓ UN PREMIO! 🏆</div>' : '';
                    const msgWs = encodeURIComponent("¡Hola! Tu mascota tiene puntos acumulados en El Club de la Manada 🐾");
                    
                    html += `
                    <tr>
                        <td>
                            ${txtPremio}
                            <div class="fw-bold text-uppercase">${f.nombre} ${f.apellido}</div>
                            <small class="text-muted d-block">${f.direccion || ''}</small>
                            <div class="mt-2 d-flex align-items-center">
                                <span class="badge bg-dark text-warning p-2 me-2" style="font-size: 1.1rem;">⭐ ${f.puntos}</span>
                                <form action="/sumar-punto" method="POST">
                                    <input type="hidden" name="id" value="${f.id}">
                                    <button class="btn btn-sm btn-success rounded-circle">+</button>
                                </form>
                            </div>
                            <div class="mt-2">
                                ${f.telefono ? '<a href="https://wa.me/'+f.telefono+'?text='+msgWs+'" target="_blank" class="btn btn-sm btn-outline-success p-1 py-0 small text-decoration-none">WhatsApp</a>' : ''}
                                <a href="/editar-cliente/${f.id}" class="btn btn-sm btn-link text-muted p-0 ms-2 small">Editar</a>
                            </div>
                        </td>
                        <td>
                            <div class="d-flex flex-wrap gap-3 mb-3">
                            // Reemplazá el bloque del .map(m => { ... }) por este:
${f.lista_m ? f.lista_m.split(',').map(m => {
    const parts = m.split('|');
    const mid = parts[0], n = parts[1], foto = parts[2], tipo = parts[3], cumple = parts[4], info = parts[5];
    const esCumple = cumple && cumple.slice(5, 10) === hoy;
    
    // LÓGICA DE IMAGEN: Si hay foto la muestra, si no, usa un Emoji según el tipo
    let contenidoImagen = '';
    if (foto) {
        contenidoImagen = `<img src="/uploads/${foto}" class="img-mascota ${esCumple ? 'cumple-hoy' : ''}" title="${info}">`;
    } else {
        const iconos = { perro: '🐶', gato: '🐱', otro: '🐰' };
        const emoji = iconos[tipo] || '🐾';
        contenidoImagen = `<div class="img-mascota d-flex align-items-center justify-content-center ${esCumple ? 'cumple-hoy' : ''}" 
                                style="font-size: 30px; background: #fff;" title="${info}">
                                ${emoji}
                           </div>`;
    }
    
    return `<div class="text-center position-relative" style="width: 70px;">
                ${contenidoImagen}
                <div style="font-size: 11px;" class="fw-bold mt-1 ${esCumple ? 'text-danger' : ''}">${esCumple ? '🎂' : ''}${n}</div>
                <a href="/eliminar-mascota/${mid}" class="position-absolute top-0 end-0 badge bg-danger rounded-circle p-1" style="font-size:8px; text-decoration:none">X</a>
            </div>`;
}).join('') : '<small class="text-muted">Sin mascotas</small>'}
                              
                            </div>
                            <form action="/agregar-mascota" method="POST" enctype="multipart/form-data" class="bg-light p-2 rounded border shadow-sm">
                                <input type="hidden" name="cliente_id" value="${f.id}">
                                <div class="row g-1">
                                    <div class="col-6"><input type="text" name="nombre_m" class="form-control form-control-sm" placeholder="Nombre" required></div>
                                    <div class="col-6"><select name="tipo" class="form-select form-select-sm"><option value="perro">Perro</option><option value="gato">Gato</option><option value="otro">Otro</option></select></div>
                                    <div class="col-6"><input type="date" name="cumple" class="form-control form-control-sm"></div>
                                    <div class="col-6"><input type="file" name="foto" class="form-control form-control-sm"></div>
                                    <div class="col-12"><input type="text" name="info" class="form-control form-control-sm" placeholder="Info/Alimento"></div>
                                    <button class="btn btn-sm btn-dark mt-1 fw-bold">Añadir</button>
                                </div>
                            </form>
                        </td>
                        <td><a href="/eliminar/${f.id}" class="text-danger" onclick="return confirm('¿Borrar?')"><i class="bi bi-trash"></i></a></td>
                    </tr>`;
                });
            }
            html += `</tbody></table></div></div></div></div>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body></html>`;
            res.send(html);
        });
    });
});

app.post('/agregar', requiereLogin, (req, res) => {
    const { nombre, apellido, telefono, direccion } = req.body;
    db.run("INSERT INTO clientes (nombre, apellido, telefono, direccion) VALUES (?,?,?,?)", [nombre, apellido, telefono, direccion], () => res.redirect('/'));
});

app.post('/sumar-punto', requiereLogin, (req, res) => {
    db.run("UPDATE clientes SET puntos = puntos + 1 WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.post('/agregar-mascota', requiereLogin, upload.single('foto'), (req, res) => {
    const { cliente_id, nombre_m, tipo, cumple, info } = req.body;
    const foto = req.file ? req.file.filename : '';
    db.run("INSERT INTO mascotas (nombre_mascota, tipo, cumple, info, foto, cliente_id) VALUES (?,?,?,?,?,?)", [nombre_m, tipo, cumple, info, foto, cliente_id], () => res.redirect('/'));
});

app.get('/eliminar-mascota/:id', requiereLogin, (req, res) => {
    db.run("DELETE FROM mascotas WHERE id = ?", [req.params.id], () => res.redirect('/'));
});

app.get('/editar-cliente/:id', requiereLogin, (req, res) => {
    db.get("SELECT * FROM clientes WHERE id = ?", [req.params.id], (err, c) => {
        res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <body style="background:#FFAA00" class="p-5">
                <div class="card mx-auto p-4 border-dark shadow" style="max-width:400px; border:3px solid #000; border-radius:20px">
                    <h3 class="fw-bold">Editar Dueño</h3>
                    <form action="/editar-cliente/${c.id}" method="POST">
                        <input name="nombre" class="form-control mb-2" value="${c.nombre}">
                        <input name="apellido" class="form-control mb-2" value="${c.apellido}">
                        <input name="telefono" class="form-control mb-2" value="${c.telefono || ''}">
                        <input name="direccion" class="form-control mb-3" value="${c.direccion || ''}">
                        <button class="btn btn-dark w-100">GUARDAR</button>
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

app.listen(port, () => console.log(`Manada activa!`));

