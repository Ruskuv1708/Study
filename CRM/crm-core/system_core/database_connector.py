from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from system_core.config import settings


# Define the database URL
#DATABASEURL = "postgresql://crm_admin:crm_secret_password@localhost:5432/crm_production_db"
DATABASE_URL = settings.DATABASE_URL

# Create the SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create a base class for declarative class definitions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a base class for declarative models
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try: 
        yield db
    finally:
        db.close()

