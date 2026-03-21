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
app = FastAPI(title="DealerSuite - Service Quality Tracker")
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
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/categories")
def list_categories():
    return crud.CATEGORIES

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
    if crud.get_demo_mode(db):
        raise HTTPException(status_code=403, detail="Demo mode active — real writes are disabled")
    return crud.create_comeback(db, comeback, logged_by=current_user.username)
@app.get("/comebacks", response_model=List[schemas.ComebackOut])
def list_comebacks(skip: int = 0, limit: int = 200, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return crud.get_comebacks(db, skip=skip, limit=limit, demo_mode=crud.get_demo_mode(db))
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
    return crud.get_dashboard_summary(db, demo_mode=crud.get_demo_mode(db))
@app.get("/comebacks/export-csv")
def export_comebacks_csv(
    start_date: str = None,
    end_date: str = None,
    technician: str = None,
    category: str = None,
    repeat_only: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    import csv, io
    from fastapi.responses import StreamingResponse
    rows = crud.get_comebacks_csv(db, start_date=start_date, end_date=end_date, technician=technician, category=category, repeat_only=repeat_only, demo_mode=crud.get_demo_mode(db))
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date","RO Number","Technician","Vehicle","VIN Last 7","Category","Customer Concern","Original Repair Date","Original Repair","Fix Performed","Root Cause","Notes","Repeat VIN","Logged By"])
    for c in rows:
        writer.writerow([str(c.comeback_date),c.ro_number or "",c.technician_name,c.vehicle or "",c.vin_last7 or "",c.repair_category or "",c.comeback_concern or "",str(c.original_repair_date) if c.original_repair_date else "",c.original_repair or "",c.fix_performed or "",c.root_cause or "",c.notes or "","Yes" if c.is_repeat_vin else "No",c.logged_by or ""])
    output.seek(0)
    filename = f"comebacks_{start_date or 'all'}_{end_date or 'all'}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})
@app.get("/dashboard/weekly-report")
def weekly_report(start_date: str = None, end_date: str = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return crud.get_weekly_report(db, start_date=start_date, end_date=end_date, demo_mode=crud.get_demo_mode(db))
@app.get("/demo/stats")
def demo_stats(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return crud.get_demo_stats(db)
@app.post("/demo/seed")
def demo_seed(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return crud.seed_demo_comebacks(db)
@app.delete("/demo/clear")
def demo_clear(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return crud.clear_demo_comebacks(db)
@app.get("/technicians", response_model=List[schemas.TechnicianOut])
def list_technicians(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return crud.get_technicians(db)
@app.get("/technicians/all", response_model=List[schemas.TechnicianOut])
def list_all_technicians(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return crud.get_all_technicians(db)
@app.post("/technicians", response_model=schemas.TechnicianOut)
def create_technician(tech: schemas.TechnicianCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can add technicians")
    return crud.create_technician(db, tech)
@app.patch("/technicians/{tech_id}/deactivate", response_model=schemas.TechnicianOut)
def deactivate_technician(tech_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    tech = crud.deactivate_technician(db, tech_id)
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return tech
@app.patch("/technicians/{tech_id}/reactivate", response_model=schemas.TechnicianOut)
def reactivate_technician(tech_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    tech = crud.reactivate_technician(db, tech_id)
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return tech
@app.delete("/technicians/{tech_id}")
def delete_technician(tech_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can remove technicians")
    tech = crud.delete_technician(db, tech_id)
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return {"ok": True}
@app.get("/settings")
def get_settings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return crud.get_all_settings(db)
@app.put("/settings/{key}")
def update_setting(key: str, body: schemas.SettingUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    allowed_keys = set(crud.SETTING_DEFAULTS.keys())
    if key not in allowed_keys:
        raise HTTPException(status_code=400, detail=f"Unknown setting key: {key}")
    return crud.upsert_setting(db, key, body.value)
@app.on_event("startup")
def run_migrations():
    import sqlite3, logging
    try:
        db_path = str(engine.url.database)
        conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(technicians)")
        cols = [row[1] for row in cursor.fetchall()]
        if "is_active" not in cols:
            cursor.execute("ALTER TABLE technicians ADD COLUMN is_active BOOLEAN DEFAULT 1 NOT NULL")
        cursor.execute("PRAGMA table_info(comebacks)")
        cols = [row[1] for row in cursor.fetchall()]
        if "is_demo" not in cols:
            cursor.execute("ALTER TABLE comebacks ADD COLUMN is_demo BOOLEAN DEFAULT 0 NOT NULL")
        if "flag" not in cols:
            cursor.execute("ALTER TABLE comebacks ADD COLUMN flag VARCHAR")
        conn.commit()
        conn.close()
    except Exception as e:
        logging.error(f"Migration runner failed (non-fatal): {e}")
@app.on_event("startup")
def seed_defaults():
    db = SessionLocal()
    try:
        if not crud.get_user_by_username(db, "manager"):
            crud.create_user(db, schemas.UserCreate(username="manager", password="mini1234", full_name="Jaime", role="manager"))
        if not crud.get_user_by_username(db, "advisor"):
            crud.create_user(db, schemas.UserCreate(username="advisor", password="advisor1234", full_name="Advisor", role="advisor"))
        if not crud.get_user_by_username(db, "foreman"):
            crud.create_user(db, schemas.UserCreate(username="foreman", password="foreman1234", full_name="Foreman", role="foreman"))
        for t in ["Jake", "Ernie", "Jeisson", "Michael", "Manny"]:
            if not crud.get_technician_by_name(db, t):
                crud.create_technician(db, schemas.TechnicianCreate(name=t, role="Technician"))
        for key, default_val in crud.SETTING_DEFAULTS.items():
            if not db.query(models.DealerSetting).filter(models.DealerSetting.key == key).first():
                db.add(models.DealerSetting(key=key, value=default_val))
        db.commit()
    finally:
        db.close()
