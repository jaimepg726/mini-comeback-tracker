from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date
import bcrypt
import models, schemas

CATEGORIES = [
    "Diagnosis", "Electrical", "Engine", "Brake", "Suspension",
    "Programming/Coding", "Oil/Leaks",
    "CBS Light Reset", "Tire Light Reset",
    "Tire Pressure Reset / Tire PSI Incorrect", "Tire/Brake Measurements Off",
    "Other",
]

def get_user_by_username(db, username):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db, user):
    hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()
    db_user = models.User(username=user.username, full_name=user.full_name, role=user.role, hashed_password=hashed)
    db.add(db_user); db.commit(); db.refresh(db_user)
    return db_user

def get_technicians(db):
    return db.query(models.Technician).filter(models.Technician.is_active == True).all()

def get_all_technicians(db):
    return db.query(models.Technician).all()

def get_technician_by_name(db, name):
    return db.query(models.Technician).filter(models.Technician.name == name).first()

def create_technician(db, tech):
    db_tech = models.Technician(name=tech.name, role=tech.role, is_active=tech.is_active)
    db.add(db_tech); db.commit(); db.refresh(db_tech)
    return db_tech

def deactivate_technician(db, tech_id):
    tech = db.query(models.Technician).filter(models.Technician.id == tech_id).first()
    if tech:
        tech.is_active = False; db.commit(); db.refresh(tech)
    return tech

def reactivate_technician(db, tech_id):
    tech = db.query(models.Technician).filter(models.Technician.id == tech_id).first()
    if tech:
        tech.is_active = True; db.commit(); db.refresh(tech)
    return tech

def delete_technician(db, tech_id):
    tech = db.query(models.Technician).filter(models.Technician.id == tech_id).first()
    if tech:
        db.delete(tech); db.commit()
    return tech

def _check_repeat_vin(db, vin_last7, exclude_id=None):
    if not vin_last7:
        return False
    q = db.query(models.Comeback).filter(models.Comeback.vin_last7 == vin_last7, models.Comeback.is_demo == False)
    if exclude_id:
        q = q.filter(models.Comeback.id != exclude_id)
    return q.count() > 0

def _update_repeat_flags(db, vin_last7):
    records = db.query(models.Comeback).filter(models.Comeback.vin_last7 == vin_last7, models.Comeback.is_demo == False).all()
    is_repeat = len(records) > 1
    for r in records:
        r.is_repeat_vin = is_repeat
    db.commit()

def create_comeback(db, comeback, logged_by):
    is_repeat = _check_repeat_vin(db, comeback.vin_last7)
    db_cb = models.Comeback(**comeback.dict(), is_repeat_vin=is_repeat, logged_by=logged_by)
    db.add(db_cb); db.commit()
    if comeback.vin_last7:
        _update_repeat_flags(db, comeback.vin_last7)
    db.refresh(db_cb)
    return db_cb

def get_comebacks(db, skip=0, limit=200):
    return db.query(models.Comeback).filter(models.Comeback.is_demo == False).order_by(models.Comeback.comeback_date.desc()).offset(skip).limit(limit).all()

def update_comeback(db, comeback_id, update):
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
    db.commit(); db.refresh(cb)
    return cb

def delete_comeback(db, comeback_id):
    cb = db.query(models.Comeback).filter(models.Comeback.id == comeback_id).first()
    if cb:
        vin = cb.vin_last7; db.delete(cb); db.commit()
        if vin:
            _update_repeat_flags(db, vin)

def get_dashboard_summary(db):
    all_cbs = db.query(models.Comeback).filter(models.Comeback.is_demo == False).all()
    techs = db.query(models.Technician).all()
    tech_stats = []
    for tech in techs:
        tech_cbs = [c for c in all_cbs if c.technician_name == tech.name]
        tech_stats.append({"technician": tech.name, "comebacks": len(tech_cbs), "repeat_vins": sum(1 for c in tech_cbs if c.is_repeat_vin)})
    category_counts = {cat: sum(1 for c in all_cbs if c.repair_category == cat) for cat in CATEGORIES}
    today = date.today()
    cutoff_30 = today - timedelta(days=30)
    cutoff_60 = today - timedelta(days=60)
    recent = [c for c in all_cbs if c.comeback_date >= cutoff_30]
    prior_30 = [c for c in all_cbs if cutoff_60 <= c.comeback_date < cutoff_30]
    repeat_vins = list(set(c.vin_last7 for c in all_cbs if c.is_repeat_vin and c.vin_last7))
    week_start = today - timedelta(days=today.weekday())
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end = week_start - timedelta(days=1)
    this_week_cbs = [c for c in all_cbs if c.comeback_date >= week_start]
    # Top category and technician this week
    week_cats: dict = {}
    week_techs: dict = {}
    for c in this_week_cbs:
        if c.repair_category:
            week_cats[c.repair_category] = week_cats.get(c.repair_category, 0) + 1
        week_techs[c.technician_name] = week_techs.get(c.technician_name, 0) + 1
    top_cat_week = max(week_cats, key=lambda k: week_cats[k]) if week_cats else None
    top_tech_week = max(week_techs, key=lambda k: week_techs[k]) if week_techs else None
    top_tech_week_count = week_techs.get(top_tech_week, 0) if top_tech_week else 0
    # 8-week trend (Mon-based weeks)
    trend_weeks = []
    for i in range(7, -1, -1):
        w_start = week_start - timedelta(days=7 * i)
        w_end = w_start + timedelta(days=6)
        cnt = len([c for c in all_cbs if w_start <= c.comeback_date <= w_end])
        trend_weeks.append({"label": w_start.strftime("%m/%d"), "count": cnt})
    return {
        "total_comebacks": len(all_cbs),
        "total_last_30_days": len(recent),
        "prev_30_days_count": len(prior_30),
        "repeat_vin_count": len(repeat_vins),
        "this_week_count": len(this_week_cbs),
        "prev_week_count": len([c for c in all_cbs if prev_week_start <= c.comeback_date <= prev_week_end]),
        "top_category_week": top_cat_week,
        "top_tech_week": top_tech_week,
        "top_tech_week_count": top_tech_week_count,
        "trend_weeks": trend_weeks,
        "technician_stats": tech_stats,
        "category_counts": category_counts,
        "recent_comebacks": [{"id": c.id, "comeback_date": str(c.comeback_date), "technician_name": c.technician_name, "vehicle": c.vehicle, "repair_category": c.repair_category, "is_repeat_vin": c.is_repeat_vin, "vin_last7": c.vin_last7} for c in sorted(recent, key=lambda x: x.comeback_date, reverse=True)[:10]]
    }

def get_weekly_report(db, start_date=None, end_date=None):
    if start_date and end_date:
        cutoff = date.fromisoformat(start_date) if isinstance(start_date, str) else start_date
        end = date.fromisoformat(end_date) if isinstance(end_date, str) else end_date
    else:
        end = date.today()
        cutoff = end - timedelta(days=end.weekday())
    week_cbs = db.query(models.Comeback).filter(models.Comeback.comeback_date >= cutoff, models.Comeback.comeback_date <= end, models.Comeback.is_demo == False).all()
    by_tech: dict = {}
    for c in week_cbs:
        by_tech.setdefault(c.technician_name, []).append(c)
    by_category: dict = {}
    for c in week_cbs:
        if c.repair_category:
            by_category[c.repair_category] = by_category.get(c.repair_category, 0) + 1
    repeat_vins_week = list(set(c.vin_last7 for c in week_cbs if c.is_repeat_vin and c.vin_last7))
    top_cat = max(by_category, key=lambda k: by_category[k]) if by_category else None
    top_tech = max(by_tech, key=lambda k: len(by_tech[k])) if by_tech else None
    highlights = {
        "top_category": top_cat,
        "top_category_count": by_category.get(top_cat, 0) if top_cat else 0,
        "top_technician": top_tech,
        "top_technician_count": len(by_tech.get(top_tech, [])) if top_tech else 0,
        "repeat_vin_count": len(repeat_vins_week),
        "techs_with_comebacks": len([k for k, v in by_tech.items() if len(v) > 0]),
    }
    return {
        "week_start": str(cutoff), "week_end": str(end),
        "total_comebacks": len(week_cbs),
        "highlights": highlights,
        "by_technician": {k: len(v) for k, v in by_tech.items()},
        "by_category": by_category,
        "repeat_vins_this_week": repeat_vins_week,
        "comebacks": [{"id": c.id, "comeback_date": str(c.comeback_date), "ro_number": c.ro_number, "technician_name": c.technician_name, "vehicle": c.vehicle, "repair_category": c.repair_category, "comeback_concern": c.comeback_concern, "is_repeat_vin": c.is_repeat_vin, "flag": c.flag} for c in sorted(week_cbs, key=lambda x: x.comeback_date, reverse=True)]
    }

def get_comebacks_csv(db, start_date=None, end_date=None, technician=None, category=None, repeat_only=False):
    q = db.query(models.Comeback).filter(models.Comeback.is_demo == False)
    if start_date:
        q = q.filter(models.Comeback.comeback_date >= date.fromisoformat(start_date))
    if end_date:
        q = q.filter(models.Comeback.comeback_date <= date.fromisoformat(end_date))
    if technician and technician != "All":
        q = q.filter(models.Comeback.technician_name == technician)
    if category and category not in ("All Categories", "All"):
        q = q.filter(models.Comeback.repair_category == category)
    if repeat_only:
        q = q.filter(models.Comeback.is_repeat_vin == True)
    return q.order_by(models.Comeback.comeback_date.desc()).all()
