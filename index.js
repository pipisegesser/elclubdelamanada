const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const app = express();
const port = process.env.PORT || 3000;

if (!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads', { recursive: true });

const db = new sqlite3.Database('./manada_v11.db');

db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, apellido TEXT, telefono TEXT, direccion TEXT, puntos INTEGER DEFAULT 0)');
    db.run('CREATE TABLE IF NOT EXISTS mascotas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre_mascota TEXT, tipo TEXT, cumple TEXT, info TEXT, foto TEXT, cliente_id INTEGER, FOREIGN KEY(cliente_id) REFERENCES clientes(id))');
    db.run('CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, rol TEXT)');
    db.get("SELECT count(*) as count FROM usuarios", (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO usuarios (username, password, rol) VALUES ('admin', 'admin123', 'admin')");
            db.run("INSERT INTO usuarios (username, password, rol) VALUES ('dueno', 'manada2026', 'usuario')");
        }
    });
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: 'manada-v11-final', resave: false, saveUninitialized: true }));

const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

function requiereLogin(req, res, next) {
    if (req.session.logueado) next(); else res.redirect('/login');
}

// --- EXPORTAR ---
app.get('/exportar', requiereLogin, async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Base de Datos Manada');
    
    sheet.columns = [
        { header: 'Dueño', key: 'dueno', width: 25 },
        { header: 'Teléfono', key: 'tel', width: 15 },
        { header: 'Dirección', key: 'dir', width: 25 },
        { header: 'Puntos', key: 'pts', width: 10 },
        { header: 'Mascota', key: 'pet', width: 15 },
        { header: 'Tipo', key: 'tipo', width: 10 },
        { header: 'Cumpleaños', key: 'cumple', width: 15 },
        { header: 'Info/Notas', key: 'info', width: 30 }
    ];

    const q = 'SELECT c.nombre, c.apellido, c.telefono, c.direccion, c.puntos, m.nombre_mascota, m.tipo, m.cumple, m.info FROM clientes c LEFT JOIN mascotas m ON c.id = m.cliente_id';
    
    db.all(q, (err, rows) => {
        if (err) return res.send("Error al exportar");
        rows.forEach(r => {
            sheet.addRow({
                dueno: r.nombre + ' ' + r.apellido,
                tel: r.telefono,
                dir: r.direccion,
                pts: r.puntos,
                pet: r.nombre_mascota,
                tipo: r.tipo,
                cumple: r.cumple,
                info: r.info
            });
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Backup_Manada_Completo.xlsx');
        workbook.xlsx.write(res).then(() => res.end());
    });
});
// --- LOGIN ---
app.get('/login', (req, res) => {
    res.send('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">' +
    '<body style="background:#FFAA00; height:100vh; display:flex; align-items:center;">' +
    '<div class="container text-center"><div class="card mx-auto p-4 shadow" style="max-width:400px; border:4px solid #000; border-radius:20px;">' +
    '<img src="/portada.jpeg" class="img-fluid mb-3 rounded border border-dark">' +
    '<h1 class="fw-bold mb-4">LOGIN</h1>' +
    '<form action="/login" method="POST">' +
    '<input type="text" name="usuario" class="form-control mb-3 border-dark" placeholder="Usuario" required>' +
    '<input type="password" name="password" class="form-control mb-4 border-dark" placeholder="Contraseña" required>' +
    '<button class="btn btn-dark w-100 fw-bold">ENTRAR</button></form></div></div></body>');
});

app.post('/login', (req, res) => {
    const { usuario, password } = req.body;
    db.get("SELECT * FROM usuarios WHERE username=? AND password=?", [usuario, password], (err, user) => {
        if (user) { req.session.logueado = true; req.session.rol = user.rol; res.redirect('/'); }
        else res.send('Error. <a href="/login">Volver</a>');
    });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// --- PANEL PRINCIPAL ---
app.get('/', requiereLogin, (req, res) => {
    const busqueda = req.query.buscar || '';
    const hoy = new Date().toISOString().slice(5, 10); 

    const query = 'SELECT c.*, GROUP_CONCAT(m.id || "|" || m.nombre_mascota || "|" || COALESCE(m.foto,"") || "|" || COALESCE(m.tipo,"perro") || "|" || COALESCE(m.cumple,"") || "|" || COALESCE(m.info,"")) as lista_m ' +
                  'FROM clientes c LEFT JOIN mascotas m ON c.id = m.cliente_id ' +
                  'WHERE c.nombre LIKE ? OR c.apellido LIKE ? OR m.nombre_mascota LIKE ? GROUP BY c.id';

    db.all(query, ['%' + busqueda + '%', '%' + busqueda + '%', '%' + busqueda + '%'], (err, filas) => {
        let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">' +
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">' +
        '<style>body{background:#FFD600;}.navbar{background:#FFAA00;border-bottom:4px solid #000;}.card{border:3px solid #000;border-radius:15px;}' +
        '.img-box{width:65px;height:65px;border:2px solid #000;border-radius:50%;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;}' +
        '.img-mascota{width:100%;height:100%;object-fit:cover;}.cumple-hoy{border:4px solid #ff4500;animation:scale 0.8s infinite alternate;}' +
        '@keyframes scale{from{transform:scale(1);}to{transform:scale(1.1);}}</style></head><body>' +
        '<nav class="navbar p-2 mb-4 shadow"><div class="container d-flex justify-content-between align-items-center">' +
        '<div class="d-flex align-items-center"><img src="/portada.jpeg" height="50" class="rounded border border-dark me-2"><h5 class="m-0 fw-bold">ESPACIO ANIMAL</h5></div>' +
        '<div><a href="/exportar" class="btn btn-sm btn-success me-2"><i class="bi bi-file-earmark-excel"></i> Excel</a><a href="/logout" class="btn btn-sm btn-dark">Salir</a></div></div></nav>' +
        '<div class="container"><div class="row"><div class="col-md-4">' +
        '<div class="card p-3 mb-3 shadow"><h5>Nuevo Dueño</h5><form action="/agregar" method="POST">' +
        '<input name="nombre" class="form-control mb-2 border-dark" placeholder="Nombre" required><input name="apellido" class="form-control mb-2 border-dark" placeholder="Apellido" required>' +
        '<input name="telefono" class="form-control mb-2 border-dark" placeholder="WhatsApp (549...)"><input name="direccion" class="form-control mb-2 border-dark" placeholder="Dirección">' +
        '<button class="btn btn-dark w-100 fw-bold">REGISTRAR DUEÑO</button></form></div>' +
        '<form action="/" method="GET" class="input-group mb-3"><input name="buscar" class="form-control border-dark" placeholder="Buscar..."><button class="btn btn-dark"><i class="bi bi-search"></i></button></form></div>' +
        '<div class="col-md-8"><div class="bg-white p-3 rounded shadow border border-dark"><table class="table align-middle"><thead><tr><th style="width:30%">DUEÑO</th><th>MASCOTAS</th></tr></thead><tbody>';

        if (filas) {
            filas.forEach(f => {
                let premio = f.puntos >= 10 ? '<div class="badge bg-danger d-block mb-1">🏆 PREMIO LISTO</div>' : '';
                // BOTÓN WHATSAPP COMÚN
                let btnWsComun = f.telefono ? '<a href="https://wa.me/' + f.telefono + '" target="_blank" class="btn btn-sm btn-outline-success py-0 px-1 ms-1"><i class="bi bi-whatsapp"></i></a>' : '';

                html += '<tr><td>' + premio + '<div class="fw-bold text-uppercase">' + f.nombre + ' ' + f.apellido + '</div>' +
                        ' <a href="/editar-cliente/' + f.id + '" class="text-primary ms-1" title="Editar Dueño"><i class="bi bi-pencil-square"></i></a></div>' +
                        '<div class="small text-muted mb-1">' + (f.direccion || "") + '</div>' +
                        '<span class="badge bg-dark text-warning p-2">⭐ ' + f.puntos + ' pts</span>' +
                        '<form action="/sumar-punto" method="POST" class="d-inline"><input type="hidden" name="id" value="' + f.id + '"><button class="btn btn-sm btn-success ms-1">+</button></form>' +
                        btnWsComun + '</td><td>' +
                        '<div class="d-flex flex-wrap gap-2 mb-3">';

    
                
                if (f.lista_m) {
                    f.lista_m.split(',').forEach(m => {
                        const p = m.split('|');
                        const esCumple = p[4] && p[4].slice(5, 10) === hoy;
                        const linkCumple = 'https://wa.me/' + f.telefono + '?text=' + encodeURIComponent('¡Feliz cumple ' + p[1] + '! 🎂 Tenés un 15% OFF en Espacio Animal.');
                        
                        html += '<div class="text-center" style="width:70px;">' +
                                '<div class="img-box ' + (esCumple ? 'cumple-hoy' : '') + '" title="' + p[5] + '">' + 
                                (p[2] ? '<img src="/uploads/' + p[2] + '" class="img-mascota">' : (p[3] === 'gato' ? '🐱' : (p[3] === 'otro' ? '🐰' : '🐶'))) + '</div>' +
                                '<div class="small fw-bold">' + (esCumple ? '<a href="' + linkCumple + '" target="_blank">🎂</a> ' : '') + p[1] + '</div>' +
                                '<div class="d-flex justify-content-center gap-1"><a href="/editar-m/' + p[0] + '" class="text-primary small"><i class="bi bi-pencil"></i></a>' +
                                '<a href="/borrar-m/' + p[0] + '" class="text-danger small" onclick="return confirm(\'¿Borrar?\')"><i class="bi bi-x-circle"></i></a></div></div>';
                    });
                }

                html += '</div><form action="/add-m" method="POST" enctype="multipart/form-data" class="bg-light p-2 rounded border small">' +
                        '<input type="hidden" name="cid" value="' + f.id + '"><div class="row g-1">' +
                        '<div class="col-6"><input name="nom" class="form-control form-control-sm" placeholder="Nombre" required></div>' +
                        '<div class="col-6"><select name="tipo" class="form-select form-select-sm"><option value="perro">Perro</option><option value="gato">Gato</option><option value="otro">Otro</option></select></div>' +
                        '<div class="col-6"><input type="date" name="cumple" class="form-control form-control-sm"></div>' +
                        '<div class="col-6"><input type="file" name="foto" class="form-control form-control-sm"></div>' +
                        '<div class="col-12"><input name="info" class="form-control form-control-sm mb-1" placeholder="Alimento/Notas"></div>' +
                        '<button class="btn btn-sm btn-dark w-100 fw-bold">AÑADIR MASCOTA</button></div></form></td></tr>';
            });
        }
        html += '</tbody></table></div></div></div></div></body></html>';
        res.send(html);
    });
});

// --- ACCIONES ---
app.post('/agregar', requiereLogin, (req, res) => {
    db.run("INSERT INTO clientes (nombre, apellido, telefono, direccion) VALUES (?,?,?,?)", [req.body.nombre, req.body.apellido, req.body.telefono, req.body.direccion], () => res.redirect('/'));
});

app.post('/sumar-punto', requiereLogin, (req, res) => {
    db.run("UPDATE clientes SET puntos = puntos + 1 WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.post('/add-m', requiereLogin, upload.single('foto'), (req, res) => {
    const { cid, nom, tipo, cumple, info } = req.body;
    const foto = req.file ? req.file.filename : '';
    db.run("INSERT INTO mascotas (nombre_mascota, tipo, cumple, info, foto, cliente_id) VALUES (?,?,?,?,?,?)", [nom, tipo, cumple, info, foto, cid], () => res.redirect('/'));
});

app.get('/borrar-m/:id', requiereLogin, (req, res) => {
    db.run("DELETE FROM mascotas WHERE id = ?", [req.params.id], () => res.redirect('/'));
});

app.get('/editar-m/:id', requiereLogin, (req, res) => {
    db.get("SELECT * FROM mascotas WHERE id = ?", [req.params.id], (err, m) => {
        res.send('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"><body style="background:#FFAA00; padding:50px;">' +
        '<div class="card mx-auto p-4 shadow" style="max-width:400px; border:3px solid #000;"><h4>Editar ' + m.nombre_mascota + '</h4>' +
        '<form action="/edit-m/' + m.id + '" method="POST" enctype="multipart/form-data">' +
        '<input name="nom" class="form-control mb-2" value="' + m.nombre_mascota + '">' +
        '<select name="tipo" class="form-select mb-2"><option value="perro" ' + (m.tipo == 'perro' ? 'selected' : '') + '>Perro</option><option value="gato" ' + (m.tipo == 'gato' ? 'selected' : '') + '>Gato</option><option value="otro" ' + (m.tipo == 'otro' ? 'selected' : '') + '>Otro</option></select>' +
        '<input type="date" name="cumple" class="form-control mb-2" value="' + m.cumple + '">' +
        '<input name="info" class="form-control mb-2" value="' + (m.info || '') + '">' +
        '<input type="file" name="foto" class="form-control mb-3">' +
        '<button class="btn btn-dark w-100 fw-bold">GUARDAR</button><a href="/" class="btn btn-link w-100 text-dark">Cancelar</a></form></div></body>');
    });
});

app.post('/edit-m/:id', requiereLogin, upload.single('foto'), (req, res) => {
    const { nom, tipo, cumple, info } = req.body;
    if (req.file) db.run("UPDATE mascotas SET nombre_mascota=?, tipo=?, cumple=?, info=?, foto=? WHERE id=?", [nom, tipo, cumple, info, req.file.filename, req.params.id], () => res.redirect('/'));
    else db.run("UPDATE mascotas SET nombre_mascota=?, tipo=?, cumple=?, info=? WHERE id=?", [nom, tipo, cumple, info, req.params.id], () => res.redirect('/'));
});


app.get('/editar-cliente/:id', requiereLogin, (req, res) => {
    db.get("SELECT * FROM clientes WHERE id = ?", [req.params.id], (err, c) => {
        if (!c) return res.redirect('/');
        res.send('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">' +
        '<body style="background:#FFAA00; padding:50px;"><div class="card mx-auto p-4 shadow" style="max-width:400px; border:3px solid #000; border-radius:15px;">' +
        '<h4>Editar Datos del Dueño</h4><form action="/editar-cliente/' + c.id + '" method="POST">' +
        '<label class="small fw-bold">Nombre</label><input name="nombre" class="form-control mb-2 border-dark" value="' + c.nombre + '">' +
        '<label class="small fw-bold">Apellido</label><input name="apellido" class="form-control mb-2 border-dark" value="' + c.apellido + '">' +
        '<label class="small fw-bold">WhatsApp (549...)</label><input name="telefono" class="form-control mb-2 border-dark" value="' + c.telefono + '">' +
        '<label class="small fw-bold">Dirección</label><input name="direccion" class="form-control mb-3 border-dark" value="' + (c.direccion || "") + '">' +
        '<button class="btn btn-dark w-100 fw-bold">GUARDAR CAMBIOS</button>' +
        '<a href="/" class="btn btn-link w-100 text-dark mt-2">Cancelar</a></form></div></body>');
    });
});

// Procesa la edición del dueño
app.post('/editar-cliente/:id', requiereLogin, (req, res) => {
    const { nombre, apellido, telefono, direccion } = req.body;
    db.run("UPDATE clientes SET nombre=?, apellido=?, telefono=?, direccion=? WHERE id=?", 
    [nombre, apellido, telefono, direccion, req.params.id], () => res.redirect('/'));
});

app.listen(port, () => console.log('Manada V11 Live!'));

