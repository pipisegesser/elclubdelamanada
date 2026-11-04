from fastapi import FastAPI, Depends, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import os

import models
import schemas
import crud
from database import SessionLocal, engine

# Crea las tablas si no existen
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="El club de la manada",
    description="API backend para la gestión de clientes, mascotas y usuarios.",
    version="1.0.0"
)

# 1. Configurar archivos estáticos (para portada.jpeg y uploads)
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# 2. Configurar las plantillas HTML
templates = Jinja2Templates(directory="templates")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- RUTA RAÍZ: REDIRIGE AL LOGIN ---
@app.get("/")
def leer_raiz():
    return RedirectResponse(url="/login", status_code=303)

# --- RUTA HTML DE LOGIN ---
@app.get("/login", response_class=HTMLResponse)
def login_view(request: Request):
    return templates.TemplateResponse(request, "login.html")

# --- VISTA HTML PRINCIPAL (Panel Visual) ---
@app.get("/panel", response_class=HTMLResponse)
def panel_principal(request: Request, buscar: str = "", db: Session = Depends(get_db)):
    # Usamos tu función de crud para obtener los clientes
    clientes = crud.obtener_clientes(db, skip=0, limit=100)
    
    # Si hay término de búsqueda, filtramos los resultados
    if buscar:
        clientes = [
            c for c in clientes 
            if buscar.lower() in c.nombre.lower() or buscar.lower() in c.apellido.lower()
        ]
        
    hoy_str = datetime.now().strftime("%m-%d")
    
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "clientes": clientes,
            "buscar": buscar,
            "hoy": hoy_str
        }
    )

# --- ACCIÓN: REGISTRAR CLIENTE DESDE EL FORMULARIO WEB ---
@app.post("/agregar-cliente")
def registrar_cliente_web(
    nombre: str = Form(...),
    apellido: str = Form(...),
    telefono: str = Form(None),
    direccion: str = Form(None),
    db: Session = Depends(get_db)
):
    # Creamos el esquema que espera tu crud
    nuevo_cliente = schemas.ClienteCreate(
        nombre=nombre,
        apellido=apellido,
        telefono=telefono,
        direccion=direccion
    )
    crud.crear_cliente(db=db, cliente=nuevo_cliente)
    return RedirectResponse(url="/panel", status_code=303)

# --- ENDPOINTS API JSON (Opcionales para Swagger / Testing) ---
@app.get("/api/clientes/", response_model=List[schemas.ClienteResponse], tags=["Clientes API"])
def listar_clientes_api(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.obtener_clientes(db, skip=skip, limit=limit)

@app.post("/api/clientes/", response_model=schemas.ClienteResponse, status_code=201, tags=["Clientes API"])
def registrar_cliente_api(cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
    return crud.crear_cliente(db=db, cliente=cliente)


# --- ACCIÓN: PROCESAR EL LOGIN ---
@app.post("/login", response_class=HTMLResponse)
def login_post(
    request: Request, 
    username: str = Form(...), 
    password: str = Form(...), 
    db: Session = Depends(get_db)
):
    return RedirectResponse(url="/panel", status_code=303)