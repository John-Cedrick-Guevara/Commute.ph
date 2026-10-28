import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

class Base(DeclarativeBase):
    pass

SUPABASE_CONNECTION_STRING = os.getenv("SUPABASE_CONNECTION_STRING")

engine = create_engine(SUPABASE_CONNECTION_STRING)
