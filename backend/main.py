from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List
import jwt
import bcrypt

from database import SessionLocal, engine
import models, schemas, crud

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MINI Comeback Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "mini-fairfield-comeback-secret-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    user = crud.get_user_by_username(db, username)
    if user is None:
        raise credentials_exception
    return user

@app.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, form_data.username)
    if not user or not bcrypt.checkpw(form_data.password.encode(), user.hashed_password.encode()):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer", "role": user.role, "name": user.full_name}

@app.get("/me", response_model=schemas.UserOut)
def read_me(current_user=Depends(get_current_user)):
    return current_user

@app.post("/comebacks", response_model=schemas.ComebackOut)
def create_comeback(comeback: schemas.ComebackCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return crud.create_comeback(db, comeback, logged_by=current_user.username)

@app.get("/comebacks", response_model=List[schemas.ComebackOut])
def list_comebacks(skip: int = 0, limit: int = 200, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return crud.get_comebacks(db, skip=skip, limit=limit)

@app.put("/comebacks/{comeback_id}", response_model=schemas.ComebackOut)
def update_comeback(comeback_id: int, update: schemas.ComebackUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can update records")
    cb = crud.update_comeback(db, comeback_id, update)
    if not cb:
        raise HTTPException(status_code=404, detail="Not found")
    return cb

@app.delete("/comebacks/{comeback_id}")
def delete_comeback(comeback_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can delete records")
    crud.delete_comeback(db, comeback_id)
    return {"ok": True}

@app.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return crud.get_dashboard_summary(db)

@app.get("/dashboard/weekly-report")
def weekly_report(start_date: str = None, end_date: str = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return crud.get_weekly_report(db, start_date=start_date, end_date=end_date)

@app.get("/technicians", response_model=List[schemas.TechnicianOut])
def list_technicians(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return crud.get_technicians(db)

@app.post("/technicians", response_model=schemas.TechnicianOut)
def create_technician(tech: schemas.TechnicianCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can add technicians")
    return crud.create_technician(db, tech)

@app.on_event("startup")
def seed_defaults():
    db = SessionLocal()
    try:
        if not crud.get_user_by_username(db, "manager"):
            crud.create_user(db, schemas.UserCreate(username="manager", password="mini1234", full_name="Jaime", role="manager"))
        if not crud.get_user_by_username(db, "advisor"):
            crud.create_user(db, schemas.UserCreate(username="advisor", password="advisor1234", full_name="Advisor", role="advisor"))
        techs = ["Jake", "Ernie", "Jeisson", "Michael", "Aaron"]
        for t in techs:
            if not crud.get_technician_by_name(db, t):
                crud.create_technician(db, schemas.TechnicianCreate(name=t, role="Technician"))
    finally:
        db.close()
