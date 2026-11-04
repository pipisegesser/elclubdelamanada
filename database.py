from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

URL_BASE_DATOS = "mysql+pymysql://root:2239fran@localhost:3306/el_club_de_la_manada"

engine = create_engine(URL_BASE_DATOS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()