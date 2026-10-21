from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class PetBase(BaseModel):
    name: str
    species: str
    breed: Optional[str] = None

class PetCreate(PetBase):
    pass

class PetResponse(PetBase):
    id: int
    client_id: int

    class Config:
        from_attributes = True

class ClientBase(BaseModel):
    name: str
    phone: str
    birth_date: Optional[date] = None
    points: Optional[int] = 0

class ClientCreate(ClientBase):
    pass

class ClientResponse(ClientBase):
    id: int
    pets: List[PetResponse] = []

    class Config:
        from_attributes = True