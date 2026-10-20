from sqlalchemy.orm import Session
import models
import schemas

def obtener_clientes(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Cliente).offset(skip).limit(limit).all()

def crear_cliente(db: Session, cliente: schemas.ClienteCreate):
    db_cliente = models.Cliente(
        nombre=cliente.nombre,
        apellido=cliente.apellido,
        telefono=cliente.telefono,
        email=cliente.email,
        direccion=cliente.direccion
    )
    db.add(db_cliente)
    db.commit()
    db.refresh(db_cliente)
    return db_cliente