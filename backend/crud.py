from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date
import bcrypt
import models, schemas

CATEGORIES = [
    "Diagnosis", "Electrical", "Engine", "Brake", "Suspension",
    "Programming/Coding", "Oil/Leaks", "CBS Light Reset",
    "Tire Pressure Reset / Tire PSI Incorrect",
    "Tire/Brake Measurements Off", "Other"
]

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()
    db_user = models.User(username=user.username, full_name=user.full_name, role=user.role, hashed_password=hashed)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_technicians(db: Session):
    return db.query(models.Technician).all()

def get_technician_by_name(db: Session, name: str):
    return db.query(models.Technician).filter(models.Technician.name == name).first()

def create_technician(db: Session, tech: schemas.TechnicianCreate):
    db_tech = models.Technician(name=tech.name, role=tech.role)
    db.add(db_tech)
    db.commit()
    db.refresh(db_tech)
    return db_tech

def delete_technician(db: Session, tech_id: int):
    tech = db.query(models.Technician).filter(models.Technician.id == tech_id).first()
    if tech:
        db.delete(tech)
        db.commit()
    return tech

def _check_repeat_vin(db: Session, vin_last7: str, exclude_id: int = None) -> bool:
    if not vin_last7:
        return False
    q = db.query(models.Comeback).filter(models.Comeback.vin_last7 == vin_last7)
    if exclude_id:
        q = q.filter(models.Comeback.id != exclude_id)
    return q.count() > 0

def create_comeback(db: Session, comeback: schemas.ComebackCreate, logged_by: str):
    is_repeat = _check_repeat_vin(db, comeback.vin_last7)
    db_cb = models.Comeback(**comeback.dict(), is_repeat_vin=is_repeat, logged_by=logged_by)
    db.add(db_cb)
    db.commit()
    if comeback.vin_last7:
        _update_repeat_flags(db, comeback.vin_last7)
    db.refresh(db_cb)
    return db_cb

def _update_repeat_flags(db: Session, vin_last7: str):
    records = db.query(models.Comeback).filter(models.Comeback.vin_last7 == vin_last7).all()
    is_repeat = len(records) > 1
    for r in records:
        r.is_repeat_vin = is_repeat
    db.commit()

def get_comebacks(db: Session, skip: int = 0, limit: int = 200):
    return db.query(models.Comeback).order_by(models.Comeback.comeback_date.desc()).offset(skip).limit(limit).all()

def update_comeback(db: Session, comeback_id: int, update: schemas.ComebackUpdate):
    cb = db.query(models.Comeback).filter(models.Comeback.id == comeback_id).first()
    if not cb:
        return None
    old_vin = cb.vin_last7
    for field, value in update.dict(exclude_unset=True).items():
        setattr(cb, field, value)
    if update.vin_last7 and update.vin_last7 != old_vin:
        cb.is_repeat_vin = _check_repeat_vin(db, update.vin_last7, exclude_id=comeback_id)
        _update_repeat_flags(db, update.vin_last7)
        if old_vin:
            _update_repeat_flags(db, old_vin)
    db.commit()
    db.refresh(cb)
    return cb

def delete_comeback(db: Session, comeback_id: int):
    cb = db.query(models.Comeback).filter(models.Comeback.id == comeback_id).first()
    if cb:
        vin = cb.vin_last7
        db.delete(cb)
        db.commit()
        if vin:
            _update_repeat_flags(db, vin)

def get_dashboard_summary(db: Session):
    all_cbs = db.query(models.Comeback).all()
    techs = db.query(models.Technician).all()

    tech_stats = []
    for tech in techs:
        tech_cbs = [c for c in all_cbs if c.technician_name == tech.name]
        tech_stats.append({
            "technician": tech.name,
            "comebacks": len(tech_cbs),
            "repeat_vins": sum(1 for c in tech_cbs if c.is_repeat_vin),
        })

    category_counts = {}
    for cat in CATEGORIES:
        count = sum(1 for c in all_cbs if c.repair_category == cat)
        category_counts[cat] = count

    cutoff = date.today() - timedelta(days=30)
    recent = [c for c in all_cbs if c.comeback_date >= cutoff]
    repeat_vins = list(set(c.vin_last7 for c in all_cbs if c.is_repeat_vin and c.vin_last7))

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end = week_start - timedelta(days=1)
    this_week_cbs = [c for c in all_cbs if c.comeback_date >= week_start]
    prev_week_cbs = [c for c in all_cbs if prev_week_start <= c.comeback_date <= prev_week_end]

    return {
        "total_comebacks": len(all_cbs),
        "total_last_30_days": len(recent),
        "repeat_vin_count": len(repeat_vins),
        "this_week_count": len(this_week_cbs),
        "prev_week_count": len(prev_week_cbs),
        "technician_stats": tech_stats,
        "category_counts": category_counts,
        "recent_comebacks": [
            {
                "id": c.id,
                "comeback_date": str(c.comeback_date),
                "technician_name": c.technician_name,
                "vehicle": c.vehicle,
                "repair_category": c.repair_category,
                "is_repeat_vin": c.is_repeat_vin,
                "vin_last7": c.vin_last7,
            }
            for c in sorted(recent, key=lambda x: x.comeback_date, reverse=True)[:10]
        ]
    }

def get_weekly_report(db: Session, start_date=None, end_date=None):
    if start_date and end_date:
        cutoff = start_date if not isinstance(start_date, str) else date.fromisoformat(start_date)
        end = end_date if not isinstance(end_date, str) else date.fromisoformat(end_date)
    else:
        end = date.today()
        weekday = end.weekday()
        cutoff = end - timedelta(days=weekday)
    week_cbs = db.query(models.Comeback).filter(
        models.Comeback.comeback_date >= cutoff,
        models.Comeback.comeback_date <= end
    ).all()

    by_tech = {}
    for c in week_cbs:
        by_tech.setdefault(c.technician_name, []).append(c)

    by_category = {}
    for c in week_cbs:
        if c.repair_category:
            by_category[c.repair_category] = by_category.get(c.repair_category, 0) + 1

    repeat_vins = list(set(c.vin_last7 for c in week_cbs if c.is_repeat_vin and c.vin_last7))

    return {
        "week_start": str(cutoff),
        "week_end": str(end),
        "total_comebacks": len(week_cbs),
        "by_technician": {k: len(v) for k, v in by_tech.items()},
        "by_category": by_category,
        "repeat_vins_this_week": repeat_vins,
        "comebacks": [
            {
                "id": c.id,
                "comeback_date": str(c.comeback_date),
                "ro_number": c.ro_number,
                "technician_name": c.technician_name,
                "vehicle": c.vehicle,
                "repair_category": c.repair_category,
                "comeback_concern": c.comeback_concern,
                "is_repeat_vin": c.is_repeat_vin,
            }
            for c in sorted(week_cbs, key=lambda x: x.comeback_date, reverse=True)
        ]
    }

def get_comebacks_csv(db: Session, start_date=None, end_date=None):
    q = db.query(models.Comeback)
    if start_date:
        q = q.filter(models.Comeback.comeback_date >= date.fromisoformat(start_date))
    if end_date:
        q = q.filter(models.Comeback.comeback_date <= date.fromisoformat(end_date))
    return q.order_by(models.Comeback.comeback_date.desc()).all()
