from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    password = Column(String(100))
    rol = Column(String(20))

class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50))
    apellido = Column(String(50))
    telefono = Column(String(30))
    email = Column(String(100), nullable=True)
    direccion = Column(String(150), nullable=True)
    
    mascotas = relationship("Mascota", back_populates="cliente")

class Mascota(Base):
    __tablename__ = "mascotas"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50))
    especie = Column(String(30))
    raza = Column(String(50), nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    
    cliente = relationship("Cliente", back_populates="mascotas")