from database import engine, Base, SessionLocal
import models

print("Creando tablas en la base de datos...")
Base.metadata.create_all(bind=engine)
print("¡Tablas creadas con éxito!")

# --- CREAR USUARIO ADMINISTRADOR POR DEFECTO ---
db = SessionLocal()
try:
    admin_existente = db.query(models.Usuario).filter(models.Usuario.username == "admin").first()
    if not admin_existente:
        nuevo_admin = models.Usuario(
            username="admin",
            password="123",  # Contraseña inicial para el TP
            rol="admin"      # Rol de administrador
        )
        db.add(nuevo_admin)
        db.commit()
        print("¡Usuario administrador creado con éxito! (Usuario: admin | Contraseña: 123)")
    else:
        print("El usuario administrador ya existe en la base de datos.")
finally:
    db.close()