from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
import models
import schemas
import crud
from database import engine, get_db

# Crea las tablas si no existen
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="El Club de la Manada API", version="2.0")

# --- Endpoints de Clientes ---
@app.post("/clients/", response_model=schemas.ClientResponse)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
    return crud.create_client(db=db, client=client)

@app.get("/clients/", response_model=list[schemas.ClientResponse])
def read_clients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    clients = crud.get_clients(db, skip=skip, limit=limit)
    return clients

@app.get("/clients/{client_id}", response_model=schemas.ClientResponse)
def read_client(client_id: int, db: Session = Depends(get_db)):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return db_client

# --- Endpoints de Mascotas por Cliente ---
@app.post("/clients/{client_id}/pets/", response_model=schemas.PetResponse)
def create_pet_for_client(client_id: int, pet: schemas.PetCreate, db: Session = Depends(get_db)):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return crud.create_client_pet(db=db, pet=pet, client_id=client_id)

@app.get("/notificaciones/cumpleanos-mascotas/")
def obtener_cumpleanos_mascotas(db: Session = Depends(get_db)):
    hoy = date.today()
    mascotas = db.query(Mascota).filter(
        extract('month', Mascota.fecha_nacimiento) == hoy.month,
        extract('day', Mascota.fecha_nacimiento) == hoy.day
    ).all()

    resultados = []
    for mascota in mascotas:
        link_wa = None
        if mascota.cliente and mascota.cliente.telefono:
            telefono_limpio = "".join(filter(str.isdigit, mascota.cliente.telefono))
            mensaje = f"¡Hola {mascota.cliente.nombre}! 🐾 Desde El Club de la Manada le deseamos un muy feliz cumpleaños a {mascota.nombre} 🎉🎂"
            mensaje_codificado = urllib.parse.quote(mensaje)
            link_wa = f"https://wa.me/{telefono_limpio}?text={mensaje_codificado}"

        resultados.append({
            "mascota_id": mascota.id,
            "nombre_mascota": mascota.nombre,
            "dueno": mascota.cliente.nombre if mascota.cliente else None,
            "telefono": mascota.cliente.telefono if mascota.cliente else None,
            "link_whatsapp": link_wa
        })

    return resultados