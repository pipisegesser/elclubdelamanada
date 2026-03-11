const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs'); // Librería para el Backup

const app = express();
const port = process.env.PORT || 3000;

if (!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads', { recursive: true });

// Base V9
const db = new sqlite3.Database('./manada_v9.db');

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
app.use(session({ secret: 'manada-v9-excel', resave: false, saveUninitialized: true }));

const upload = multer({ dest: 'public/uploads/' });

function requiereLogin(req, res, next) {
    if (req.session.logueado) next(); else res.redirect('/login');
}

// --- EXPORTAR EXCEL ---
app.get('/exportar', requiereLogin, async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Clientes y Mascotas');
    sheet.columns = [
        { header: 'Dueño', key: 'dueno', width: 20 },
        { header: 'Teléfono', key: 'tel', width: 15 },
        { header: 'Mascota', key: 'pet', width: 15 },
        { header: 'Cumpleaños', key: 'cumple', width: 15 },
        { header: 'Puntos', key: 'pts', width: 10 }
    ];

    db.all('SELECT c.nombre, c.apellido, c.telefono, c.puntos, m.nombre_mascota, m.cumple FROM clientes c LEFT JOIN mascotas m ON c.id = m.cliente_id', (err, rows) => {
        rows.forEach(r => {
            sheet.addRow({ dueno: r.nombre + ' ' + r.apellido, tel: r.telefono, pet: r.nombre_mascota, cumple: r.cumple, pts: r.puntos });
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Backup_Manada.xlsx');
        workbook.xlsx.write(res).then(() => res.end());
    });
});

// --- GESTIÓN DE USUARIOS (Solo Admin) ---
app.get('/usuarios', requiereLogin, (req, res) => {
    if (req.session.rol !== 'admin') return res.send('No tenés permiso');
    db.all('SELECT * FROM usuarios', (err, users) => {
        let html = '<h1>Usuarios</h1><ul>';
        users.forEach(u => {
            html += `<li>${u.username} (${u.rol}) <a href="/borrar-usuario/${u.id}">Borrar</a></li>`;
        });
        html += '</ul><a href="/">Volver</a>';
        res.send(html);
    });
});

app.get('/borrar-usuario/:id', requiereLogin, (req, res) => {
    if (req.session.rol === 'admin') db.run('DELETE FROM usuarios WHERE id=?', [req.params.id]);
    res.redirect('/usuarios');
});

// --- LOGIN ---
app.get('/login', (req, res) => {
    res.send('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">' +
    '<body style="background:#FFAA00; height:100vh; display:flex; align-items:center;">' +
    '<div class="container text-center"><div class="card mx-auto p-4 shadow" style="max-width:400px; border:4px solid #000;">' +
    '<img src="/portada.jpeg" class="img-fluid mb-3 rounded border border-dark">' +
    '<h1 class="fw-bold mb-4">LOGIN</h1>' +
    '<form action="/login" method="POST">' +
    '<input type="text" name="usuario" class="form-control mb-3 border-dark" placeholder="Usuario" required>' +
    '<input type="password" name="password" class="form-control mb-4 border-dark" placeholder="Clave" required>' +
    '<button class="btn btn-dark w-100 fw-bold">ENTRAR</button></form></div></div></body>');
});

app.post('/login', (req, res) => {
    const { usuario, password } = req.body;
    db.get("SELECT * FROM usuarios WHERE username=? AND password=?", [usuario, password], (err, user) => {
        if (user) { 
            req.session.logueado = true; 
            req.session.rol = user.rol; 
            res.redirect('/'); 
        } else res.send('Error. <a href="/login">Volver</a>');
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
        db.get("SELECT COUNT(*) as total FROM mascotas", (err, stat) => {
            let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">' +
            '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">' +
            '<style>body{background:#FFD600;}.navbar{background:#FFAA00;border-bottom:4px solid #000;}.card{border:3px solid #000;border-radius:15px;}' +
            '.img-box{width:65px;height:65px;border:2px solid #000;border-radius:50%;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;}' +
            '.img-mascota{width:100%;height:100%;object-fit:cover;}.cumple-hoy{border:4px solid #ff4500;animation:scale 0.8s infinite alternate;}' +
            '@keyframes scale{from{transform:scale(1);}to{transform:scale(1.1);}}</style></head><body>' +
            '<nav class="navbar p-2 mb-4 shadow"><div class="container d-flex justify-content-between align-items-center">' +
            '<div class="d-flex align-items-center"><img src="/portada.jpeg" height="50" class="rounded border border-dark me-2"><h5 class="m-0 fw-bold">ESPACIO ANIMAL</h5></div>' +
            '<div>' + (req.session.rol === 'admin' ? '<a href="/usuarios" class="btn btn-sm btn-outline-dark me-2">Usuarios</a>' : '') +
            '<a href="/exportar" class="btn btn-sm btn-success me-2"><i class="bi bi-file-earmark-excel"></i> Excel</a>' +
            '<a href="/logout" class="btn btn-sm btn-dark">Salir</a></div></div></nav>' +
            '<div class="container"><div class="row"><div class="col-md-4">' +
            '<div class="card p-3 mb-3 shadow"><h5>Nuevo Dueño</h5><form action="/agregar" method="POST">' +
            '<input name="nombre" class="form-control mb-2" placeholder="Nombre" required><input name="apellido" class="form-control mb-2" placeholder="Apellido" required>' +
            '<input name="telefono" class="form-control mb-2" placeholder="549..."><input name="direccion" class="form-control mb-2" placeholder="Dirección">' +
            '<button class="btn btn-dark w-100">REGISTRAR</button></form></div></div>' +
            '<div class="col-md-8"><div class="bg-white p-3 rounded shadow border border-dark"><table class="table"><thead><tr><th>DUEÑO</th><th>MASCOTAS</th></tr></thead><tbody>';

            if (filas) {
                filas.forEach(f => {
                    let alerta = f.puntos >= 10 ? '<div class="badge bg-danger mb-1">🏆 PREMIO LISTO</div>' : '';
                    html += '<tr><td>' + alerta + '<div class="fw-bold">' + f.nombre + ' ' + f.apellido + '</div>' +
                            '⭐ ' + f.puntos + ' pts <form action="/sumar-punto" method="POST" class="d-inline"><input type="hidden" name="id" value="' + f.id + '"><button class="btn btn-sm btn-success">+</button></form></td><td><div class="d-flex flex-wrap gap-2">';
                    
                    if (f.lista_m) {
                        f.lista_m.split(',').forEach(m => {
                            const p = m.split('|');
                            const esCumple = p[4] && p[4].slice(5, 10) === hoy;
                            // MENSAJE DE WHATSAPP DE CUMPLEAÑOS
                            const msgCumple = encodeURIComponent('¡Feliz cumple ' + p[1] + '! 🎂 Por tu cumple tenés un 15% en toda tu compra en Espacio Animal. ¡Te esperamos!');
                            const linkWs = 'https://wa.me/' + f.telefono + '?text=' + msgCumple;

                            html += '<div class="text-center">' +
                                    '<div class="img-box ' + (esCumple ? 'cumple-hoy' : '') + '">' + (p[2] ? '<img src="/uploads/' + p[2] + '" class="img-mascota">' : '🐾') + '</div>' +
                                    '<div class="small fw-bold">' + (esCumple ? '<a href="' + linkWs + '" target="_blank" style="text-decoration:none">🎂</a>' : '') + p[1] + '</div>' +
                                    '</div>';
                        });
                    }
                    html += '</div></td></tr>';
                });
            }
            html += '</tbody></table></div></div></div></div></body></html>';
            res.send(html);
        });
    });
});

app.post('/agregar', requiereLogin, (req, res) => {
    db.run("INSERT INTO clientes (nombre, apellido, telefono, direccion) VALUES (?,?,?,?)", [req.body.nombre, req.body.apellido, req.body.telefono, req.body.direccion], () => res.redirect('/'));
});

app.post('/sumar-punto', requiereLogin, (req, res) => {
    db.run("UPDATE clientes SET puntos = puntos + 1 WHERE id = ?", [req.body.id], () => res.redirect('/'));
});

app.listen(port, () => console.log('Manada V9 Finalizada'));
