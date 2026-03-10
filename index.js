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
    
    // 7. BUSCADOR INTELIGENTE (Busca por dueño o por nombre de mascota)
    const query = `
        SELECT c.*, GROUP_CONCAT(m.id || '|' || m.nombre_mascota || '|' || COALESCE(m.foto,'') || '|' || m.tipo || '|' || COALESCE(m.cumple_mascota,'')) as lista_m
        FROM clientes c
        LEFT JOIN mascotas m ON c.id = m.cliente_id
        WHERE c.nombre LIKE ? OR c.apellido LIKE ? OR m.nombre_mascota LIKE ?
        GROUP BY c.id
    `;

    db.all(query, [`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`], (err, filas) => {
        // 8. ESTADÍSTICAS RÁPIDAS
        db.get("SELECT COUNT(*) as total FROM mascotas", (err, stat) => {
            const totalMascotas = stat ? stat.total : 0;

            let html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Panel El Club de la Manada</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
                <style>
                    body { background: #FFD600; }
                    .navbar { background: #FFAA00; border-bottom: 4px solid #000; }
                    .card { border: 3px solid #000; border-radius: 15px; box-shadow: 5px 5px 0px #000; }
                    .alerta-premio { 
                        background: #fdfd96; border: 3px dashed #ff4500; padding: 10px; 
                        font-weight: bold; color: #d94300; animation: flash 1s infinite;
                    }
                    @keyframes flash { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
                    .img-mascota { width: 50px; height: 50px; object-fit: cover; border: 2px solid #000; border-radius: 50%; background: white; }
                </style>
            </head>
            <body>
                <nav class="navbar p-3 mb-4">
                    <div class="container d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <img src="/portada.jpg" height="50" class="me-3 border border-dark rounded">
                            <h4 class="fw-bold m-0 text-dark">LA MANADA <span class="badge bg-dark">${totalMascotas} Mascotas</span></h4>
                        </div>
                        <a href="/logout" class="btn btn-dark btn-sm">Salir</a>
                    </div>
                </nav>

                <div class="container">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="card p-3 mb-4">
                                <h5 class="fw-bold">🐾 Registrar Cliente</h5>
                                <form action="/agregar" method="POST">
                                    <input type="text" name="nombre" class="form-control mb-2" placeholder="Nombre" required>
                                    <input type="text" name="apellido" class="form-control mb-2" placeholder="Apellido" required>
                                    <input type="text" name="telefono" class="form-control mb-2" placeholder="WhatsApp">
                                    <input type="text" name="direccion" class="form-control mb-3" placeholder="Dirección">
                                    <button class="btn btn-dark w-100">DAR DE ALTA</button>
                                </form>
                            </div>
                            <form method="GET" action="/" class="input-group mb-4">
                                <input type="text" name="buscar" class="form-control border-dark" placeholder="Buscar dueño o mascota..." value="${busqueda}">
                                <button class="btn btn-dark"><i class="bi bi-search"></i></button>
                            </form>
                        </div>

                        <div class="col-md-8">
                            <div class="bg-white p-3 rounded shadow border border-dark">
                                <table class="table table-hover align-middle">
                                    <thead class="table-dark">
                                        <tr>
                                            <th>DUEÑO</th>
                                            <th>MASCOTAS</th>
                                            <th>ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>`;

            filas.forEach(f => {
                // 6. ALERTA DE PREMIO (Si llega a 10 puntos)
                let alertaHtml = f.puntos >= 10 ? 
                    `<div class="alerta-premio mt-1 small">⭐ ¡FELICITACIONES ${f.nombre}! GANASTE UN PREMIO ⭐</div>` : '';

                html += `
                <tr>
                    <td>
                        <div class="fw-bold text-uppercase">${f.nombre} ${f.apellido}</div>
                        <small class="text-muted"><i class="bi bi-whatsapp"></i> ${f.telefono || '-'}</small><br>
                        <small class="text-muted"><i class="bi bi-house"></i> ${f.direccion || '-'}</small>
                        <div class="mt-2">
                            <span class="badge bg-dark text-warning p-2">Puntos: ${f.puntos}</span>
                            <form action="/sumar-punto" method="POST" class="d-inline">
                                <input type="hidden" name="id" value="${f.id}">
                                <button class="btn btn-sm btn-success rounded-circle ms-1">+</button>
                            </form>
                        </div>
                        ${alertaHtml}
                        <a href="/editar-cliente/${f.id}" class="btn btn-link btn-sm p-0 text-dark">Editar datos</a>
                    </td>
                    <td>
                        <div class="d-flex flex-wrap gap-2 mb-3">
                            ${f.lista_m ? f.lista_m.split(',').map(m => {
                                const [mid, n, foto, tipo, cumple] = m.split('|');
                                // 3. ICONO SEGÚN TIPO
                                let imagenSrc = foto ? `/uploads/${foto}` : `/uploads/${tipo || 'otro'}.png`;
                                return `
                                <div class="text-center position-relative" style="width: 60px;">
                                    <img src="${imagenSrc}" class="img-mascota border-dark">
                                    <div style="font-size: 10px;" class="fw-bold">${n}</div>
                                    <a href="/eliminar-mascota/${mid}" class="position-absolute top-0 end-0 badge bg-danger rounded-circle p-1" onclick="return confirm('¿Borrar mascota?')">×</a>
                                </div>`;
                            }).join('') : '<small>Sin mascotas</small>'}
                        </div>
                        <form action="/agregar-mascota" method="POST" class="row g-1">
                            <input type="hidden" name="cliente_id" value="${f.id}">
                            <div class="col-6"><input type="text" name="nombre_mascota" class="form-control form-control-sm" placeholder="Nombre" required></div>
                            <div class="col-6">
                                <select name="tipo" class="form-select form-select-sm">
                                    <option value="perro">Perro</option>
                                    <option value="gato">Gato</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                            <div class="col-12"><input type="date" name="cumple" class="form-control form-control-sm" title="Cumpleaños"></div>
                            <div class="col-12"><button class="btn btn-sm btn-dark w-100">Añadir</button></div>
                        </form>
                    </td>
                    <td>
                        <a href="/eliminar/${f.id}" class="btn btn-outline-danger btn-sm" onclick="return confirm('¿Eliminar dueño y todas sus mascotas?')"><i class="bi bi-trash"></i></a>
                    </td>
                </tr>`;
            });

            html += `</tbody></table></div></div></div></div></body></html>`;
            res.send(html);
        });
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

// --- 5. ELIMINAR MASCOTA ---
app.get('/eliminar-mascota/:id', requiereLogin, (req, res) => {
    db.run("DELETE FROM mascotas WHERE id = ?", [req.params.id], () => {
        res.redirect('/');
    });
});

// --- 4. EDITAR CLIENTE (VISTA) ---
app.get('/editar-cliente/:id', requiereLogin, (req, res) => {
    db.get("SELECT * FROM clientes WHERE id = ?", [req.params.id], (err, cliente) => {
        if (!cliente) return res.redirect('/');
        res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>body { background: #FFAA00; padding-top: 50px; font-family: sans-serif; }</style>
            <div class="container"><div class="card mx-auto shadow border-dark" style="max-width: 500px; border: 3px solid #000; border-radius: 20px;">
                <div class="card-body p-4">
                    <h3 class="fw-bold mb-4">Editar Datos de ${cliente.nombre}</h3>
                    <form action="/editar-cliente/${cliente.id}" method="POST">
                        <label>Nombre</label><input type="text" name="nombre" class="form-control mb-2" value="${cliente.nombre}">
                        <label>Apellido</label><input type="text" name="apellido" class="form-control mb-2" value="${cliente.apellido}">
                        <label>WhatsApp</label><input type="text" name="telefono" class="form-control mb-2" value="${cliente.telefono || ''}">
                        <label>Dirección</label><input type="text" name="direccion" class="form-control mb-4" value="${cliente.direccion || ''}">
                        <div class="d-flex gap-2">
                            <button class="btn btn-dark w-100 fw-bold">GUARDAR CAMBIOS</button>
                            <a href="/" class="btn btn-outline-dark">Cancelar</a>
                        </div>
                    </form>
                </div>
            </div></div>
        `);
    });
});

// --- 4. EDITAR CLIENTE (PROCESAR) ---
app.post('/editar-cliente/:id', requiereLogin, (req, res) => {
    const { nombre, apellido, telefono, direccion } = req.body;
    db.run(
        "UPDATE clientes SET nombre = ?, apellido = ?, telefono = ?, direccion = ? WHERE id = ?",
        [nombre, apellido, telefono, direccion, req.params.id],
        () => res.redirect('/')
    );
});


app.listen(port, () => console.log(`Servidor Manada listo!`));


