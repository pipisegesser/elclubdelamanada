from fastapi import FastAPI, Request, Form, Depends, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import hashlib
import os
import models
import schemas
import crud
from database import SessionLocal, engine
from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="El club de la manada",
    description="API backend para la gestión de clientes, mascotas y usuarios.",
    version="1.0.0"
)

os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- UTILIDADES DE SEGURIDAD ---
def hashear_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def verificar_sesion(request: Request) -> Optional[str]:
    return request.cookies.get("sesion_usuario")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Crea el usuario admin inicial en la BD si no hay usuarios registrados
with SessionLocal() as db:
    if not db.query(models.Usuario).first():
        admin_inicial = models.Usuario(
            username="admin",
            password=hashear_password("admin123"),
            rol="admin"
        )
        db.add(admin_inicial)
        db.commit()

# --- LOGIN / LOGOUT ---
@app.get("/")
def leer_raiz():
    return RedirectResponse(url="/login", status_code=303)

@app.get("/login", response_class=HTMLResponse)
def login_view(request: Request, error: Optional[str] = None):
    return templates.TemplateResponse(request, "login.html", {"error": error})

@app.post("/login")
def login_post(
    usuario: str = Form(...), 
    password: str = Form(...), 
    db: Session = Depends(get_db)
):
    user_db = db.query(models.Usuario).filter(models.Usuario.username == usuario).first()
    
    if user_db and user_db.password == hashear_password(password):
        response = RedirectResponse(url="/panel", status_code=303)
        # Cookie HttpOnly para que JavaScript no pueda robar la sesión
        response.set_cookie(key="sesion_usuario", value=user_db.username, httponly=True)
        response.set_cookie(key="sesion_rol", value=user_db.rol or "empleado", httponly=True)
        return response
        
    return RedirectResponse(url="/login?error=1", status_code=303)

@app.get("/logout")
def logout_view():
    response = RedirectResponse(url="/login", status_code=303)
    response.delete_cookie("sesion_usuario")
    response.delete_cookie("sesion_rol")
    return response

# --- VISTA PRINCIPAL PROTEGIDA ---
@app.get("/panel", response_class=HTMLResponse)
def panel_principal(request: Request, buscar: str = "", db: Session = Depends(get_db)):
    usuario_actual = verificar_sesion(request)
    if not usuario_actual:
        return RedirectResponse(url="/login", status_code=303)

    clientes = crud.obtener_clientes(db, skip=0, limit=100)
    if buscar:
        clientes = [
            c for c in clientes 
            if buscar.lower() in c.nombre.lower() or buscar.lower() in c.apellido.lower()
        ]
        
    hoy_str = datetime.now().strftime("%m-%d")
    rol_actual = request.cookies.get("sesion_rol", "empleado")
    
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "clientes": clientes,
            "buscar": buscar,
            "hoy": hoy_str,
            "usuario": usuario_actual,
            "rol": rol_actual
        }
    )

# --- ADMINISTRACIÓN DE USUARIOS (Solo Admin) ---
@app.get("/usuarios", response_class=HTMLResponse)
def gestionar_usuarios(request: Request, db: Session = Depends(get_db)):
    usuario_actual = verificar_sesion(request)
    rol_actual = request.cookies.get("sesion_rol")
    if not usuario_actual or rol_actual != "admin":
        return RedirectResponse(url="/panel", status_code=303)
        
    usuarios = db.query(models.Usuario).all()
    return templates.TemplateResponse(
        request, 
        "usuarios.html", 
        {"usuarios": usuarios, "usuario": usuario_actual}
    )

@app.post("/usuarios/crear")
def crear_usuario_web(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    rol: str = Form("empleado"),
    db: Session = Depends(get_db)
):
    if request.cookies.get("sesion_rol") != "admin":
        return RedirectResponse(url="/panel", status_code=303)
        
    existe = db.query(models.Usuario).filter(models.Usuario.username == username).first()
    if not existe:
        nuevo = models.Usuario(
            username=username,
            password=hashear_password(password),
            rol=rol
        )
        db.add(nuevo)
        db.commit()
    return RedirectResponse(url="/usuarios", status_code=303)

@app.post("/usuarios/eliminar/{usuario_id}")
def eliminar_usuario_web(request: Request, usuario_id: int, db: Session = Depends(get_db)):
    if request.cookies.get("sesion_rol") != "admin":
        return RedirectResponse(url="/panel", status_code=303)
        
    user = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    # Evita que el admin se borre a sí mismo
    if user and user.username != request.cookies.get("sesion_usuario"):
        db.delete(user)
        db.commit()
    return RedirectResponse(url="/usuarios", status_code=303)

# --- CLIENTES Y MASCOTAS (Protegidos) ---
@app.post("/agregar-cliente")
def registrar_cliente_web(
    request: Request,
    nombre: str = Form(...),
    apellido: str = Form(...),
    telefono: str = Form(None),
    direccion: str = Form(None),
    db: Session = Depends(get_db)
):
    if not verificar_sesion(request):
        return RedirectResponse(url="/login", status_code=303)
    nuevo_cliente = schemas.ClienteCreate(
        nombre=nombre,
        apellido=apellido,
        telefono=telefono,
        direccion=direccion
    )
    crud.crear_cliente(db=db, cliente=nuevo_cliente)
    return RedirectResponse(url="/panel", status_code=303)

@app.post("/eliminar-cliente/{cliente_id}")
def eliminar_cliente_web(request: Request, cliente_id: int, db: Session = Depends(get_db)):
    if not verificar_sesion(request):
        return RedirectResponse(url="/login", status_code=303)
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if cliente:
        db.delete(cliente)
        db.commit()
    return RedirectResponse(url="/panel", status_code=303)

@app.post("/sumar-punto/{cliente_id}")
def sumar_punto_web(request: Request, cliente_id: int, db: Session = Depends(get_db)):
    if not verificar_sesion(request):
        return RedirectResponse(url="/login", status_code=303)
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if cliente:
        cliente.puntos = (cliente.puntos or 0) + 1
        db.commit()
    return RedirectResponse(url="/panel", status_code=303)

@app.post("/agregar-mascota")
def agregar_mascota_post(
    request: Request,
    cid: int = Form(...),
    nom: str = Form(...),
    tipo: str = Form(...),
    cumple: Optional[str] = Form(None),
    info: Optional[str] = Form(None),
    foto: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    if not verificar_sesion(request):
        return RedirectResponse(url="/login", status_code=303)
    nueva_mascota = models.Mascota(
        nombre=nom,
        especie=tipo,
        raza=info,
        cumple=cumple,
        cliente_id=cid
    )
    db.add(nueva_mascota)
    db.commit()
    return RedirectResponse(url="/panel", status_code=303)

@app.post("/eliminar-mascota/{mascota_id}")
def eliminar_mascota_web(request: Request, mascota_id: int, db: Session = Depends(get_db)):
    if not verificar_sesion(request):
        return RedirectResponse(url="/login", status_code=303)
    mascota = db.query(models.Mascota).filter(models.Mascota.id == mascota_id).first()
    if mascota:
        db.delete(mascota)
        db.commit()
    return RedirectResponse(url="/panel", status_code=303)

# --- ENDPOINTS API JSON ---
@app.get("/api/clientes/", response_model=List[schemas.ClienteResponse], tags=["Clientes API"])
def listar_clientes_api(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.obtener_clientes(db, skip=skip, limit=limit)

@app.post("/api/clientes/", response_model=schemas.ClienteResponse, status_code=201, tags=["Clientes API"])
def registrar_cliente_api(cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
    return crud.crear_cliente(db=db, cliente=cliente)