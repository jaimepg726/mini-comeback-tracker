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

SETTING_DEFAULTS = {
    "repeat_vin_window_days": "0",     # 0 = all-time
    "dashboard_week_start": "Monday",
    "demo_mode_enabled": "false",
}

def get_setting(db, key: str) -> str:
    s = db.query(models.DealerSetting).filter(models.DealerSetting.key == key).first()
    return s.value if s else SETTING_DEFAULTS.get(key, "")

def get_all_settings(db) -> dict:
    result = dict(SETTING_DEFAULTS)
    for s in db.query(models.DealerSetting).all():
        result[s.key] = s.value
    return result

def get_demo_mode(db) -> bool:
    return get_setting(db, "demo_mode_enabled").lower() == "true"

def upsert_setting(db, key: str, value: str) -> dict:
    s = db.query(models.DealerSetting).filter(models.DealerSetting.key == key).first()
    if s:
        s.value = value
    else:
        s = models.DealerSetting(key=key, value=value)
        db.add(s)
    db.commit()
    return {"key": key, "value": value}

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

def _check_repeat_vin(db, vin_last7, exclude_id=None, window_days=0):
    if not vin_last7:
        return False
    q = db.query(models.Comeback).filter(models.Comeback.vin_last7 == vin_last7, models.Comeback.is_demo == False)
    if window_days and window_days > 0:
        cutoff = date.today() - timedelta(days=window_days)
        q = q.filter(models.Comeback.comeback_date >= cutoff)
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
    try:
        window_days = int(get_setting(db, "repeat_vin_window_days"))
    except (ValueError, TypeError):
        window_days = 0
    is_repeat = _check_repeat_vin(db, comeback.vin_last7, window_days=window_days)
    data = comeback.model_dump()
    # Normalize: empty string flag → None
    if not data.get("flag"):
        data["flag"] = None
    db_cb = models.Comeback(**data, is_repeat_vin=is_repeat, logged_by=logged_by)
    db.add(db_cb); db.commit()
    if comeback.vin_last7:
        _update_repeat_flags(db, comeback.vin_last7)
    db.refresh(db_cb)
    return db_cb

def get_comebacks(db, skip=0, limit=200, demo_mode=False):
    return db.query(models.Comeback).filter(models.Comeback.is_demo == demo_mode).order_by(models.Comeback.comeback_date.desc()).offset(skip).limit(limit).all()

def update_comeback(db, comeback_id, update):
    cb = db.query(models.Comeback).filter(models.Comeback.id == comeback_id).first()
    if not cb:
        return None
    old_vin = cb.vin_last7
    for field, value in update.model_dump(exclude_unset=True).items():
        # Normalize empty flag to None
        if field == "flag" and not value:
            value = None
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

def get_dashboard_summary(db, demo_mode=False):
    all_cbs = db.query(models.Comeback).filter(models.Comeback.is_demo == demo_mode).all()
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

def get_weekly_report(db, start_date=None, end_date=None, demo_mode=False):
    if start_date and end_date:
        cutoff = date.fromisoformat(start_date) if isinstance(start_date, str) else start_date
        end = date.fromisoformat(end_date) if isinstance(end_date, str) else end_date
    else:
        end = date.today()
        cutoff = end - timedelta(days=end.weekday())
    week_cbs = db.query(models.Comeback).filter(models.Comeback.comeback_date >= cutoff, models.Comeback.comeback_date <= end, models.Comeback.is_demo == demo_mode).all()
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

def get_comebacks_csv(db, start_date=None, end_date=None, technician=None, category=None, repeat_only=False, demo_mode=False):
    q = db.query(models.Comeback).filter(models.Comeback.is_demo == demo_mode)
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

# ─── Demo data ───────────────────────────────────────────────────────────────

def get_demo_stats(db) -> dict:
    total_demo = db.query(models.Comeback).filter(models.Comeback.is_demo == True).count()
    total_real = db.query(models.Comeback).filter(models.Comeback.is_demo == False).count()
    demo_technicians = (
        db.query(func.count(models.Comeback.technician_name.distinct()))
          .filter(models.Comeback.is_demo == True)
          .scalar() or 0
    )
    demo_categories = (
        db.query(func.count(models.Comeback.repair_category.distinct()))
          .filter(models.Comeback.is_demo == True)
          .scalar() or 0
    )
    return {
        "total_demo": total_demo,
        "total_real": total_real,
        "demo_technicians": demo_technicians,
        "demo_categories": demo_categories,
    }

def clear_demo_comebacks(db) -> dict:
    count = db.query(models.Comeback).filter(models.Comeback.is_demo == True).count()
    db.query(models.Comeback).filter(models.Comeback.is_demo == True).delete()
    db.commit()
    return {"cleared": count}

def seed_demo_comebacks(db) -> dict:
    today = date.today()
    # (days_ago, tech, vin, vehicle, category, concern, orig_repair, fix, root_cause, flag, ro)
    R = [
        # ── 3 weeks ago ──────────────────────────────────────────────────────
        (21, "Jake",    "B72K903", "2022 MINI Cooper S",       "Electrical",
         "Customer states driver power window inoperative day after regulator replacement",
         "Window regulator replacement LF",
         "Found window motor binding on track; replaced motor and track assembly",
         "Regulator misaligned during initial installation", "Safety", "10001"),
        (20, "Ernie",   "T44F981", "2023 MINI Clubman",        "Diagnosis",
         "Check engine light returned same week as oil service",
         "Engine oil service 5W-30 full synthetic",
         "Found loose oil cap causing evap leak P0457; re-torqued and cleared code",
         "Oil cap not fully seated post-service", None, "10002"),
        (20, "Jeisson", "N22G456", "2021 MINI Countryman",     "Brake",
         "Customer states brake pedal soft after brake fluid flush",
         "Brake fluid flush, all four corners bled",
         "Found air pocket in rear caliper; re-bled using pressure bleeder",
         "Incomplete bleed on rear passenger caliper", "Safety", "10003"),
        (19, "Michael", "K99H782", "2020 MINI Cooper SE",      "Suspension",
         "Clunking from front suspension continues after strut replacement",
         "Front strut replacement LF and RF",
         "Found loose strut top nut; torqued to spec 50 ft-lbs",
         "Strut top nut not torqued to specification", None, "10004"),
        (19, "Manny",   "P33J001", "2022 MINI Convertible",    "CBS Light Reset",
         "CBS service light on 3 days after CBS reset",
         "Oil service and CBS reset performed",
         "Module not accepting reset via standard procedure; performed via ISTA coding",
         "Reset procedure timeout during original service", None, "10005"),
        (18, "Jake",    "Q11M220", "2023 MINI JCW Hatch",      "Engine",
         "Oil leak at valve cover persists after gasket replacement last month",
         "Valve cover gasket replacement",
         "Found gasket improperly seated at rear corner; replaced with OEM, torque sequence corrected",
         "Incorrect installation sequence — gasket pinched at rear", None, "10006"),
        (18, "Ernie",   "T44F981", "2023 MINI Clubman",        "Tire Light Reset",
         "Tire warning light came back on 1 week after sensor replacement",
         "TPMS sensor replacement RF",
         "Found RF sensor not initialized; performed relearn procedure with TPMS tool",
         "Sensor installed but relearn procedure skipped", None, "10007"),
        (17, "Jeisson", "R77A432", "2021 MINI Hatch",          "Programming/Coding",
         "Navigation system unresponsive since software update last visit",
         "iDrive software update",
         "Performed full ISTA software flash; reset NBT module to factory",
         "Incomplete write cycle during update due to low voltage", None, "10008"),
        (17, "Michael", "S55D190", "2022 MINI Clubman ALL4",   "Oil/Leaks",
         "Customer reports excessive oil consumption since engine service 3 weeks ago",
         "Engine oil service + air filter replacement",
         "Found incorrect viscosity used; drained and refilled with correct 5W-30",
         "5W-40 used instead of specified 5W-30 LL-04", "Customer Satisfaction", "10009"),
        (16, "Manny",   "Z88C671", "2022 MINI Paceman",        "Tire Pressure Reset / Tire PSI Incorrect",
         "TPMS light still on after all 4 tires inflated and sensor check performed",
         "Tire rotation and pressure check",
         "Found RF tire had nail-caused slow leak; patched and reinflated, reset TPMS",
         "Nail in tire missed during rotation inspection", None, "10010"),
        # ── 2 weeks ago ──────────────────────────────────────────────────────
        (15, "Jake",    "B72K903", "2022 MINI Cooper S",       "Diagnosis",
         "Customer returned with check engine light after timing chain job prior week",
         "Timing chain replacement",
         "Found cam sensor unplugged after chain job; reconnected, cleared P0340",
         "Cam sensor harness dislodged during chain replacement", "Escalated", "10011"),
        (14, "Ernie",   "W66E345", "2023 MINI Convertible",    "Electrical",
         "Horn inoperative after clock spring replacement during airbag service",
         "Airbag service and clock spring replacement",
         "Found horn relay blown due to incorrect wiring at spring connector; replaced relay",
         "Wiring harness reversed at clock spring connector", "Safety", "10012"),
        (14, "Jeisson", "N22G456", "2021 MINI Countryman",     "CBS Light Reset",
         "CBS light returning after reset was performed 2 weeks ago",
         "Oil service and CBS reset",
         "Found CBS module requiring software update per TSB; updated via ISTA",
         "TSB not applied during original service", None, "10013"),
        (13, "Michael", "K99H782", "2020 MINI Cooper SE",      "Electrical",
         "Radio and Bluetooth not functioning since infotainment update",
         "iDrive software update requested by customer",
         "Performed full software reflash; restored customer Bluetooth profiles",
         "Corrupted install due to power interruption during write", "Customer Satisfaction", "10014"),
        (13, "Manny",   "P33J001", "2022 MINI Convertible",    "Engine",
         "Rough idle and hesitation on acceleration after throttle body cleaning",
         "Throttle body cleaning and idle relearn",
         "Performed idle adaptation and throttle body relearn per procedure",
         "Relearn procedure skipped after cleaning", None, "10015"),
        (12, "Jake",    "Q11M220", "2023 MINI JCW Hatch",      "Suspension",
         "Steering pulling right after 4-wheel alignment performed last week",
         "4-wheel alignment to spec",
         "Found RF tire severely worn on inside edge; replaced tire and re-aligned",
         "Worn tire not identified during pre-alignment inspection", None, "10016"),
        (12, "Ernie",   "R77A432", "2021 MINI Hatch",          "Tire/Brake Measurements Off",
         "Brake pad measurements given at service differ from dashboard indicator",
         "Brake inspection and pad measurement",
         "Found rear pads at 2mm; replaced rear pads, recalibrated sensors",
         "Rear pads not measured during inspection — only fronts checked", "Customer Satisfaction", "10017"),
        (11, "Jeisson", "S55D190", "2022 MINI Clubman ALL4",   "Programming/Coding",
         "Bluetooth pairing lost and all settings reset after battery replacement",
         "Battery replacement 60Ah AGM",
         "Performed battery registration via ISTA; restored module memory values",
         "Battery registration not performed post-replacement", None, "10018"),
        (11, "Michael", "Z88C671", "2022 MINI Paceman",        "Diagnosis",
         "Multiple codes present after coolant system pressure test last visit",
         "Coolant expansion tank replacement",
         "Found cracked coolant line at connection; replaced line and re-pressure tested",
         "Cracked hose not identified during pressure test", None, "10019"),
        (10, "Manny",   "W66E345", "2023 MINI Convertible",    "Brake",
         "ABS and brake warning lights on after front caliper rebuild",
         "Front brake caliper rebuild LF",
         "Found ABS wheel speed sensor damaged during caliper work; replaced sensor",
         "Speed sensor harness pinched during caliper installation", "Safety", "10020"),
        (10, "Jake",    "B72K903", "2022 MINI Cooper S",       "Electrical",
         "Interior lights flicker and radio resets intermittently — third visit same complaint",
         "Electrical diagnostic and chassis ground strap replacement",
         "Found main chassis ground splice corroded; replaced ground splice and harness section",
         "Root cause ground corruption not fully resolved on prior two visits", "Escalated", "10021"),
        # ── Last week ────────────────────────────────────────────────────────
        (7,  "Ernie",   "T44F981", "2023 MINI Clubman",        "Oil/Leaks",
         "Oil drips under vehicle 5 days after oil service",
         "Engine oil service 5W-30",
         "Found drain plug overtorqued; thread damage caused seepage. Installed thread repair insert",
         "Drain plug overtorqued causing thread damage", None, "10022"),
        (7,  "Jeisson", "N22G456", "2021 MINI Countryman",     "Brake",
         "Brake shudder at highway speeds since brake job 2 weeks ago",
         "Front brake pads and rotors replacement",
         "Rotors warped during bed-in from improper heat cycling; replaced rotors, performed proper bed-in",
         "Bed-in procedure not communicated or performed with customer", "Customer Satisfaction", "10023"),
        (6,  "Michael", "K99H782", "2020 MINI Cooper SE",      "Tire Pressure Reset / Tire PSI Incorrect",
         "PSI readings incorrect on dash after tire pressure adjustment at last service",
         "Tire pressure check and adjustment all 4 tires",
         "Found TPMS sensor in LF tire failed; replaced sensor and performed relearn",
         "Failed TPMS sensor not identified during pressure service", None, "10024"),
        (6,  "Manny",   "P33J001", "2022 MINI Convertible",    "CBS Light Reset",
         "CBS light on again — third time this month",
         "CBS light reset via OBD tool",
         "Oil quality sensor determined faulty; replaced sensor and performed CBS reset via ISTA",
         "Faulty oil quality sensor triggering premature CBS warnings", "Escalated", "10025"),
        (5,  "Jake",    "Q11M220", "2023 MINI JCW Hatch",      "Engine",
         "Coolant temp warning and engine running hot after thermostat replacement",
         "Thermostat replacement",
         "Found air lock in cooling system; performed cooling system bleed procedure",
         "Cooling system bleed not performed after thermostat replacement", "Safety", "10026"),
        (5,  "Ernie",   "R77A432", "2021 MINI Hatch",          "Other",
         "Squeaking from engine bay after belt replacement last visit",
         "Serpentine belt replacement",
         "Found tensioner pulley bearing failing; replaced complete tensioner assembly",
         "Tensioner bearing wear missed during belt inspection", None, "10027"),
        (4,  "Jeisson", "S55D190", "2022 MINI Clubman ALL4",   "Electrical",
         "Headlights flickering and auto-leveling not working since ballast replacement",
         "HID ballast replacement LF",
         "Found loose connector at leveling motor; reseated and secured with OEM clip",
         "Leveling motor connector not fully seated during ballast work", None, "10028"),
        (4,  "Michael", "Z88C671", "2022 MINI Paceman",        "Suspension",
         "Creaking from rear over speed bumps after rear shock replacement",
         "Rear shock replacement both sides",
         "Found rear shock mount bushing cracked on driver side; replaced mount bushing",
         "Worn mount bushing not inspected during shock replacement", None, "10029"),
        # ── This week ────────────────────────────────────────────────────────
        (3,  "Manny",   "B72K903", "2022 MINI Cooper S",       "Diagnosis",
         "Vehicle back for check engine light — fourth visit, same customer complaint",
         "Extended electrical diagnostic",
         "Found oxygen sensor heater circuit fault P0036; replaced O2 sensor and cleared",
         "Intermittent fault requiring extended drive cycle to reproduce", "Escalated", "10030"),
        (2,  "Jake",    "W66E345", "2023 MINI Convertible",    "Tire/Brake Measurements Off",
         "Customer concerned measurements given at service don't match prior visit",
         "Brake inspection multi-point",
         "Found RF caliper sticking, causing accelerated inside pad wear; replaced caliper",
         "Seized caliper slide pins not lubricated during last pad service", "Customer Satisfaction", "10031"),
        (2,  "Ernie",   "T44F981", "2023 MINI Clubman",        "CBS Light Reset",
         "CBS light on immediately after leaving dealership post-oil service",
         "Oil service and CBS reset",
         "Found incorrect oil grade used; drained, refilled correct 5W-30 LL-04, reset CBS",
         "Wrong oil grade installed (5W-40 vs spec 5W-30)", None, "10032"),
        (1,  "Jeisson", "N22G456", "2021 MINI Countryman",     "Programming/Coding",
         "EV charging not working after software update — customer cannot charge at home",
         "MINI Connected software update",
         "Rolled back to prior software version; EV charging module re-coded per TSB",
         "Incompatible software version for this model year / charging module", "Safety", "10033"),
        (1,  "Michael", "K99H782", "2020 MINI Cooper SE",      "Electrical",
         "Battery warning light on and 12V not charging after auxiliary battery replacement",
         "12V auxiliary battery replacement",
         "Found battery registration not completed; performed registration via ISTA",
         "Battery registration skipped post-replacement", None, "10034"),
        (0,  "Manny",   "P33J001", "2022 MINI Convertible",    "Oil/Leaks",
         "Customer found oil spot in driveway same day as oil change — very upset",
         "Engine oil service",
         "Found loose oil filter; torqued to spec, leak resolved",
         "Oil filter hand-tightened only, not torqued to specification", "Customer Satisfaction", "10035"),
    ]

    for (d, tech, vin, veh, cat, concern, orig, fix, root, flag, ro) in R:
        cb_date = today - timedelta(days=d)
        db.add(models.Comeback(
            comeback_date=cb_date,
            original_repair_date=cb_date - timedelta(days=3),
            ro_number=ro,
            vin_last7=vin,
            vehicle=veh,
            technician_name=tech,
            original_repair=orig,
            comeback_concern=concern,
            repair_category=cat,
            fix_performed=fix,
            root_cause=root,
            flag=flag,
            is_demo=True,
            is_repeat_vin=False,
            logged_by="demo_seed",
        ))
    db.commit()

    # Update repeat-VIN flags within demo records
    demo_vins = set(r[2] for r in R)
    for vin in demo_vins:
        recs = db.query(models.Comeback).filter(
            models.Comeback.vin_last7 == vin,
            models.Comeback.is_demo == True
        ).all()
        flag_val = len(recs) > 1
        for rec in recs:
            rec.is_repeat_vin = flag_val
    db.commit()

    count = db.query(models.Comeback).filter(models.Comeback.is_demo == True).count()
    return {"seeded": count}
