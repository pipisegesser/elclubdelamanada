# El Club de la Manada

Sistema web de gestión integral para pet shops, orientado al control de clientes, sus mascotas y un sistema automatizado de fidelización por puntos, descuentos y notificaciones por WhatsApp.

## Tecnologías Utilizadas

- **Backend:** FastAPI (Python)
- **Base de Datos & ORM:** MySQL + SQLAlchemy
- **Validación de Datos:** Pydantic
- **Frontend / Vistas:** Jinja2 Templates, HTML, CSS (con soporte de archivos estáticos)
- **Seguridad / Control de Acceso:** Gestión de usuarios y roles (`admin`)

---

##  Estructura del Proyecto

```text
.
├── main.py             # Archivo principal de FastAPI (Rutas Web y API REST)
├── models.py           # Modelos ORM de SQLAlchemy (Usuario, Cliente, Mascota)
├── schemas.py          # Esquemas de validación con Pydantic
├── crud.py             # Funciones de lógica de base de datos (CRUD)
├── database.py         # Configuración del motor de conexión y sesión
├── create_db.py        # Script para la creación inicial de la base de datos MySQL
├── init_db.py          # Script para la creación de tablas y usuario administrador por defecto
├── static/             # Archivos estáticos (CSS, imágenes, uploads)
└── templates/          # Plantillas HTML renderizadas con Jinja2
