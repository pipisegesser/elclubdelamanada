from sqlalchemy.orm import Session
from sqlalchemy import extract
from datetime import date
import models
import schemas

# --- Clientes ---
def get_client(db: Session, client_id: int):
    return db.query(models.Client).filter(models.Client.id == client_id).first()

def get_clients(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Client).offset(skip).limit(limit).all()

def create_client(db: Session, client: schemas.ClientCreate):
    db_client = models.Client(**client.dict())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

# --- Mascotas ---
def create_client_pet(db: Session, pet: schemas.PetCreate, client_id: int):
    db_pet = models.Pet(**pet.dict(), client_id=client_id)
    db.add(db_pet)
    db.commit()
    db.refresh(db_pet)
    return db_pet

def get_mascotas_cumple_hoy(db: Session):
    hoy = date.today()
    return db.query(models.Mascota).filter(
        extract('month', models.Mascota.fecha_nacimiento) == hoy.month,
        extract('day', models.Mascota.fecha_nacimiento) == hoy.day
    ).all()