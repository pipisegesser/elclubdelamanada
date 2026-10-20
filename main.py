from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
import crud
from database import SessionLocal, engine

app = FastAPI(
    title="El club de la manada",
    description="API backend para la gestión de clientes, mascotas y usuarios.",
    version="1.0.0"
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def leer_raiz():
    return {"mensaje": "Bienvenido al backend de El club de la manada 🐾"}

@app.get("/clientes/", response_model=List[schemas.ClienteResponse], tags=["Clientes"])
def listar_clientes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.obtener_clientes(db, skip=skip, limit=limit)

@app.post("/clientes/", response_model=schemas.ClienteResponse, status_code=201, tags=["Clientes"])
def registrar_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
    return crud.crear_cliente(db=db, cliente=cliente)