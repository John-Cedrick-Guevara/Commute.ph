import os

from dotnev import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

SUPABASE_CONNECTION_STRING = os.getenv("SUPABASE_CONNECTION_STRING")

engine = create_engine(SUPABASE_CONNECTION_STRING)
