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
    "repeat_vin_window_days": "0",         # 0 = all-time
    "dashboard_week_start": "Monday",
    "demo_mode_enabled": "false",
    "demo_seed_total_comebacks": "87",     # int >= 1
    "demo_seed_unique_vins": "69",         # int >= 1, <= total
    "demo_seed_start_date": "2026-01-01",  # date <= today
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
    _demo = models.Comeback.is_demo == True
    total_demo = db.query(models.Comeback).filter(_demo).count()
    total_real = db.query(models.Comeback).filter(models.Comeback.is_demo == False).count()
    demo_technicians = (
        db.query(func.count(models.Comeback.technician_name.distinct()))
          .filter(_demo).scalar() or 0
    )
    demo_categories = (
        db.query(func.count(models.Comeback.repair_category.distinct()))
          .filter(_demo).scalar() or 0
    )
    unique_vins = (
        db.query(func.count(models.Comeback.vin_last7.distinct()))
          .filter(_demo).scalar() or 0
    )
    date_agg = (
        db.query(func.min(models.Comeback.comeback_date), func.max(models.Comeback.comeback_date))
          .filter(_demo).first()
    )
    date_start = date_agg[0].isoformat() if date_agg and date_agg[0] else None
    date_end   = date_agg[1].isoformat() if date_agg and date_agg[1] else None
    repeated_vins_count = (
        db.query(func.count(models.Comeback.vin_last7.distinct()))
          .filter(_demo, models.Comeback.is_repeat_vin == True).scalar() or 0
    )
    configured_total = int(get_setting(db, "demo_seed_total_comebacks") or 87)
    configured_vins  = int(get_setting(db, "demo_seed_unique_vins")      or 69)
    configured_start = get_setting(db, "demo_seed_start_date") or "2026-01-01"
    return {
        "total_demo": total_demo,
        "total_real": total_real,
        "demo_technicians": demo_technicians,
        "demo_categories": demo_categories,
        "unique_vins": unique_vins,
        "date_start": date_start,
        "date_end": date_end,
        "repeated_vins_count": repeated_vins_count,
        "configured_total": configured_total,
        "configured_vins": configured_vins,
        "configured_start": configured_start,
    }

def clear_demo_comebacks(db) -> dict:
    count = db.query(models.Comeback).filter(models.Comeback.is_demo == True).count()
    db.query(models.Comeback).filter(models.Comeback.is_demo == True).delete()
    db.commit()
    return {"cleared": count}

def seed_demo_comebacks(db) -> dict:  # noqa: C901
    import random as _rng

    # ── Read seed config ──────────────────────────────────────────────────────
    total     = max(1, int(get_setting(db, "demo_seed_total_comebacks") or 87))
    n_vins    = min(max(1, int(get_setting(db, "demo_seed_unique_vins")  or 69)), total)
    start_str = get_setting(db, "demo_seed_start_date") or "2026-01-01"
    today     = date.today()
    try:
        start_dt = date.fromisoformat(start_str)
    except ValueError:
        start_dt = date(2026, 1, 1)
    if start_dt > today:
        start_dt = today
    span_days   = max(1, (today - start_dt).days)
    recent_days = min(42, span_days)   # bias window: last 6 weeks

    # ── Clear existing demo records (idempotent) ──────────────────────────────
    db.query(models.Comeback).filter(models.Comeback.is_demo == True).delete()
    db.commit()

    # ── Deterministic RNG — reproducible demo every time ─────────────────────
    rng = _rng.Random(20260101)

    # ── 7-char VIN pool (VIN-style chars: no I, O, Q) ────────────────────────
    _C, _D = "ABCDEFGHJKLMNPRSTUVWXYZ", "0123456789"
    seen_v: set = set()
    vin_pool: list = []
    while len(vin_pool) < n_vins:
        v = (rng.choice(_C) + rng.choice(_D) + rng.choice(_D) +
             rng.choice(_C) + rng.choice(_D) + rng.choice(_D) + rng.choice(_D))
        if v not in seen_v:
            seen_v.add(v); vin_pool.append(v)

    # ── One consistent vehicle model per VIN ──────────────────────────────────
    _VEHICLES = [
        "2022 MINI Cooper S", "2023 MINI Clubman", "2021 MINI Countryman",
        "2020 MINI Cooper SE", "2022 MINI Convertible", "2023 MINI JCW Hatch",
        "2021 MINI Hatch", "2022 MINI Clubman ALL4", "2023 MINI Convertible",
        "2024 MINI Cooper", "2021 MINI JCW Clubman", "2020 MINI Paceman",
        "2023 MINI Countryman", "2022 MINI 3-Door Hatch",
    ]
    vin_vehicle = {v: rng.choice(_VEHICLES) for v in vin_pool}

    # ── Distribute comebacks: 1 per VIN, extras spread across ~35% as repeats ─
    counts = {v: 1 for v in vin_pool}
    extras = total - n_vins
    if extras > 0:
        n_prob   = min(max(int(n_vins * 0.35), extras), n_vins)
        prob_vins = rng.sample(vin_pool, n_prob)
        added = 0
        while added < extras:
            v = rng.choice(prob_vins)
            if counts[v] < 4:
                counts[v] += 1; added += 1

    assignments = [(v, i) for v, c in counts.items() for i in range(c)]
    rng.shuffle(assignments)

    # ── Weighted tech + category distributions ────────────────────────────────
    _TECHS  = ["Jake", "Ernie", "Jeisson", "Michael", "Manny"]
    _TECH_W = [30, 25, 20, 15, 10]
    _CATS   = ["Electrical","Diagnosis","Brake","Programming/Coding","CBS Light Reset",
               "Engine","Oil/Leaks","Suspension","Tire Light Reset",
               "Tire Pressure Reset / Tire PSI Incorrect","Tire/Brake Measurements Off","Other"]
    _CAT_W  = [15, 14, 12, 10, 10, 8, 8, 7, 5, 4, 4, 3]
    _FLAGS  = [None]*75 + ["Safety"]*8 + ["Escalated"]*8 + ["Customer Satisfaction"]*9

    # ── Category-specific (concern, original_repair, fix_performed, root_cause) ─
    _SCRIPTS = {
        "Electrical": [
            ("Customer states power window inoperative after regulator replacement",
             "Window regulator replacement LF",
             "Found window motor binding on track; replaced motor and track assembly",
             "Regulator misaligned during initial installation"),
            ("Interior lights flicker and radio resets intermittently since battery service",
             "12V battery replacement",
             "Found main chassis ground splice corroded; replaced splice and harness section",
             "Ground corruption not fully resolved — intermittent fault"),
            ("Horn inoperative after clock spring replacement during airbag service",
             "Airbag service and clock spring replacement",
             "Found horn relay blown from reversed wiring; replaced relay and corrected connector",
             "Wiring harness reversed at clock spring connector during install"),
            ("Radio and Bluetooth non-functional since infotainment update",
             "iDrive software update requested by customer",
             "Performed full software reflash; restored customer Bluetooth profiles",
             "Corrupted install due to power interruption during write"),
            ("Headlights flickering and auto-leveling inoperative after ballast replacement",
             "HID ballast replacement LF",
             "Reseated loose connector at leveling motor; secured with OEM clip",
             "Leveling motor connector not fully seated during ballast work"),
            ("Backup camera no image since rear bumper sensor replacement",
             "Rear parking sensor replacement",
             "Found camera connector corroded at housing; replaced connector and sealed",
             "Camera harness exposed to moisture after bumper seal was disturbed"),
            ("Heated driver seat not functioning after seat foam replacement",
             "Driver seat foam pad replacement",
             "Traced open circuit to disconnected heating element connector under seat",
             "Heating element connector not reconnected during upholstery work"),
        ],
        "Diagnosis": [
            ("Check engine light returned same week as oil service",
             "Engine oil service 5W-30 full synthetic",
             "Found loose oil cap causing evap leak P0457; re-torqued and cleared code",
             "Oil cap not fully seated post-service"),
            ("Multiple warning lights present after coolant system pressure test",
             "Coolant expansion tank replacement",
             "Found cracked hose at connection point; replaced hose and re-pressure tested",
             "Cracked hose not identified during pressure test"),
            ("MIL on with P0300 random misfire after tune-up",
             "Spark plug replacement all cylinders",
             "Found cracked coil boot on cyl 3; replaced coil assembly",
             "Cracked coil boot not identified during spark plug service"),
            ("Check engine light P0171 lean code returned after O2 sensor replacement",
             "Upstream O2 sensor replacement",
             "Found vacuum leak at intake boot; replaced intake boot",
             "Intake boot crack causing lean condition not identified pre-repair"),
            ("Transmission warning light on after fluid exchange",
             "Automatic transmission fluid exchange",
             "Found incorrect fluid spec used; drained and refilled with approved ETL 8072B",
             "Incorrect fluid specification used during exchange"),
            ("Vehicle hesitates on cold start since fuel injector cleaning",
             "Fuel injector cleaning service",
             "Found injector 2 partially clogged post-clean; replaced injector",
             "Incomplete clean on injector 2 due to heavy carbon deposits"),
        ],
        "Brake": [
            ("Brake pedal soft after brake fluid flush",
             "Brake fluid flush, all four corners bled",
             "Found air pocket in rear caliper; re-bled using pressure bleeder",
             "Incomplete bleed on rear passenger caliper"),
            ("Brake shudder at highway speeds since brake job two weeks ago",
             "Front brake pads and rotors replacement",
             "Rotors warped during improper bed-in; replaced rotors and performed correct procedure",
             "Bed-in procedure not communicated or performed with customer"),
            ("ABS and brake warning lights on after front caliper rebuild",
             "Front brake caliper rebuild LF",
             "Found ABS wheel speed sensor harness damaged during caliper work; replaced sensor",
             "Speed sensor harness pinched during caliper installation"),
            ("Grinding noise from RF since front pad replacement last week",
             "Brake pad replacement front axle",
             "Found anti-squeal shim missing on RF; installed shim and road tested",
             "Anti-squeal shim not reinstalled during pad replacement"),
            ("Excessive brake pedal travel after rear caliper piston service",
             "Rear caliper piston wind-back and pad replacement",
             "Found EPB actuator not reset; performed actuator reset procedure via ISTA",
             "EPB actuator wind-back procedure not completed post-service"),
            ("Rear brake drag and premature wear after parking brake cable adjustment",
             "Parking brake cable adjustment",
             "Found cable over-adjusted causing partial engagement; readjusted to specification",
             "Cable over-tightened beyond specification causing constant light drag"),
        ],
        "Programming/Coding": [
            ("Navigation system unresponsive since software update last visit",
             "iDrive software update",
             "Performed full ISTA software flash; reset NBT module to factory default",
             "Incomplete write cycle during update due to low vehicle voltage"),
            ("Bluetooth pairing lost and all settings reset after battery replacement",
             "Battery replacement 60Ah AGM",
             "Performed battery registration via ISTA; restored module memory values",
             "Battery registration not performed post-replacement"),
            ("EV charging inoperative after MINI Connected software update",
             "MINI Connected software update",
             "Rolled back to prior software version; re-coded EV charging module per TSB",
             "Incompatible software version for this model year / charging module"),
            ("DSC off and steering assist lost after control module coding session",
             "Engine control module coding for performance upgrade",
             "Restored correct DSC variant coding via ISTA; road tested all chassis systems",
             "Incorrect variant code written to DSC module during coding session"),
            ("Cruise control non-functional after instrument cluster replacement",
             "Instrument cluster replacement",
             "Programmed replacement cluster with VIN-specific data; adapted cruise module",
             "Replacement cluster required VIN programming not performed at delivery"),
            ("Start-Stop system disabled after TCU gearbox software flash",
             "Gearbox software update per TSB",
             "Found Start-Stop enable bit cleared by TSB flash; re-enabled via ISTA",
             "TSB flash unintentionally reset Start-Stop enable flag"),
        ],
        "CBS Light Reset": [
            ("CBS service light on 3 days after CBS reset",
             "Oil service and CBS reset performed",
             "Module not accepting reset via standard tool; performed via ISTA coding",
             "Reset procedure timeout during original service visit"),
            ("CBS light returning — third visit this month for same complaint",
             "CBS light reset via OBD tool",
             "Oil quality sensor found faulty; replaced sensor and reset CBS via ISTA",
             "Faulty oil quality sensor triggering premature CBS warnings"),
            ("CBS light on immediately after leaving dealership post-oil service",
             "Engine oil service and CBS reset",
             "Found incorrect oil grade; drained, refilled with correct 5W-30 LL-04, reset CBS",
             "Wrong oil grade installed (5W-40 vs specified 5W-30 LL-04)"),
            ("CBS brake interval warning on after pads and rotor replacement",
             "Brake pad and rotor service front axle",
             "Found brake wear sensor not replaced; installed sensor and reset CBS",
             "Brake wear sensor not replaced during pad service as required by procedure"),
            ("CBS light triggered again within 200 miles of last reset",
             "Routine oil service and multi-point inspection",
             "Performed CBS adaptation reset via ISTA; confirmed oil level and quality in range",
             "CBS counter not fully reset using OBD tool — requires ISTA for this model year"),
        ],
        "Engine": [
            ("Oil leak at valve cover persists after gasket replacement last month",
             "Valve cover gasket replacement",
             "Found gasket improperly seated at rear corner; replaced OEM gasket with correct torque sequence",
             "Incorrect installation sequence — gasket pinched at rear during initial repair"),
            ("Rough idle and hesitation on acceleration after throttle body cleaning",
             "Throttle body cleaning and idle relearn",
             "Performed idle adaptation and throttle body relearn per MINI procedure",
             "Relearn procedure skipped after throttle body cleaning"),
            ("Coolant temp warning and engine running hot after thermostat replacement",
             "Thermostat replacement",
             "Found air lock in cooling system; performed cooling system bleed procedure",
             "Cooling system bleed not performed after thermostat replacement"),
            ("Timing chain noise returned within 2 weeks of chain kit replacement",
             "Timing chain kit replacement",
             "Found chain tensioner pre-load set incorrectly; replaced tensioner and upper guide",
             "Chain tensioner pre-load not set to specification during initial repair"),
            ("Engine misfiring on cyl 4 after spark plug service",
             "Spark plug replacement all cylinders and coil check",
             "Found coil 4 connector loose; reseated and secured with OEM retaining clip",
             "Coil 4 connector not fully latched during service"),
            ("Oil pressure warning light on after valve clearance adjustment",
             "Valve clearance check and adjustment",
             "Found oil passage partially blocked by old gasket debris; flushed and cleared",
             "Old gasket material entered oil passage during cylinder head work"),
        ],
        "Oil/Leaks": [
            ("Customer states excessive oil consumption since engine service 3 weeks ago",
             "Engine oil service + air filter replacement",
             "Found incorrect viscosity used; drained and refilled with correct 5W-30",
             "5W-40 used instead of specified 5W-30 LL-04"),
            ("Oil drips under vehicle 5 days after oil service",
             "Engine oil service 5W-30 full synthetic",
             "Found drain plug overtorqued causing thread damage; installed thread repair insert",
             "Drain plug overtorqued during service causing thread damage"),
            ("Customer found oil spot in driveway same day as oil change",
             "Engine oil service",
             "Found loose oil filter; torqued to specification, leak resolved",
             "Oil filter hand-tightened only, not torqued to specification"),
            ("Coolant drip at upper hose fitting after cooling system service",
             "Coolant flush and system refill",
             "Found upper hose clamp left loose; tightened to spec and pressure tested",
             "Hose clamp not fully tightened after refill during prior service"),
            ("Power steering fluid drip after rack and pinion replacement",
             "Rack and pinion replacement",
             "Found high-pressure line fitting under-torqued; torqued to spec and road tested",
             "High-pressure fitting under-torqued during rack installation"),
            ("Transmission fluid leak at pan gasket after fluid service",
             "Automatic transmission fluid pan reseal",
             "Re-torqued all pan bolts in correct cross-pattern sequence; leak resolved",
             "Torque sequence not followed — corner bolt backed out causing seep"),
        ],
        "Suspension": [
            ("Clunking from front suspension continues after strut replacement",
             "Front strut replacement LF and RF",
             "Found loose strut top nut; torqued to specification 50 ft-lbs",
             "Strut top nut not torqued to specification"),
            ("Steering pulling right after 4-wheel alignment performed last week",
             "4-wheel alignment to specification",
             "Found RF tire severely worn on inside edge; replaced tire and re-aligned",
             "Worn tire not identified during pre-alignment inspection"),
            ("Creaking from rear over speed bumps after rear shock replacement",
             "Rear shock replacement both sides",
             "Found rear shock mount bushing cracked on driver side; replaced mount bushing",
             "Worn mount bushing not inspected during shock replacement"),
            ("Vehicle wanders on highway after front wheel bearing replacement",
             "Front wheel bearing replacement LF",
             "Found alignment shifted from bearing work; re-aligned all four wheels",
             "Alignment check not performed after wheel bearing replacement"),
            ("Knocking from front end after lower control arm replacement",
             "Lower control arm replacement LF",
             "Found sway bar end link loose; tightened to specification and verified torque",
             "Sway bar end link not torqued during control arm work"),
            ("Vibration at highway speed after tire balance and rotation",
             "Tire balance and rotation all four",
             "Found wheel weight missing on RF; rebalanced all four wheels on-car",
             "Wheel weight adhesion failure — road debris impact after service"),
        ],
        "Tire Light Reset": [
            ("Tire warning light came back on one week after sensor replacement",
             "TPMS sensor replacement RF",
             "Found RF sensor not initialized; performed full vehicle relearn with TPMS tool",
             "Sensor installed but relearn procedure skipped"),
            ("TPMS warning light on next day after all 4 sensors replaced",
             "All 4 TPMS sensor replacement",
             "Found LR sensor missing from relearn sequence; re-performed full vehicle relearn",
             "LR sensor excluded from relearn sequence during initial service"),
            ("Tire pressure warning immediately after tire rotation",
             "Tire rotation all four wheels",
             "Performed TPMS relearn after rotation; confirmed all four sensors registering",
             "TPMS relearn not performed after rotation — sensor positions swapped in system"),
            ("TPMS light flashing on cold mornings since winter tire changeover",
             "Winter tire changeover and installation",
             "Identified winter TPMS sensors needing relearn for new set; performed full relearn",
             "Winter tire TPMS sensors not registered to vehicle during changeover"),
        ],
        "Tire Pressure Reset / Tire PSI Incorrect": [
            ("TPMS light still on after all 4 tires inflated and sensor check performed",
             "Tire rotation and pressure check",
             "Found RF tire slow leak from nail; patched, reinflated, and reset TPMS",
             "Nail in RF tire missed during rotation inspection"),
            ("PSI readings incorrect on dashboard after tire pressure adjustment at last service",
             "Tire pressure check and adjustment all 4 tires",
             "Found TPMS sensor in LF tire failed; replaced sensor and performed relearn",
             "Failed TPMS sensor not identified during pressure service"),
            ("Front tires losing pressure gradually since last tire service",
             "Tire pressure check and nitrogen fill all 4",
             "Found valve stem cores loose on both front tires; tightened and leak-tested",
             "Valve stem cores not fully retorqued after service"),
            ("Dashboard shows LR tire at 15 PSI despite customer inflating this morning",
             "Tire pressure check at routine oil service",
             "Found LR valve stem damaged and leaking; replaced valve stem and reset TPMS",
             "Damaged valve stem not identified during visual tire inspection"),
        ],
        "Tire/Brake Measurements Off": [
            ("Brake pad measurements given at service differ from dashboard wear indicator",
             "Brake inspection and pad measurement multi-point",
             "Found rear pads at 2mm; replaced rear pads and recalibrated wear sensors",
             "Rear pads not measured during inspection — only fronts checked"),
            ("Customer states front tires show more wear than inspection report indicated",
             "Multi-point inspection with tire tread depth check",
             "Re-inspected RF; found 2/32 below safe threshold — replaced tire",
             "RF tire tread depth misread or transcribed incorrectly on inspection form"),
            ("Customer concerned brake measurements do not match prior visit report",
             "Brake inspection multi-point",
             "Found RF caliper sticking, causing accelerated inner pad wear; replaced caliper",
             "Seized caliper slide pins not lubricated during last pad service"),
            ("Alignment report shows within spec but vehicle tracks noticeably left",
             "4-wheel alignment check and adjustment",
             "Discovered alignment printout was from prior vehicle; re-aligned correctly",
             "Paperwork mix-up — prior vehicle alignment results printed on customer invoice"),
        ],
        "Other": [
            ("Squeaking from engine bay after serpentine belt replacement",
             "Serpentine belt replacement",
             "Found tensioner pulley bearing failing; replaced complete tensioner assembly",
             "Tensioner bearing wear missed during belt inspection"),
            ("Windshield wiper streaking immediately after blade replacement",
             "Windshield wiper blade replacement front",
             "Found incorrect blade profile for model; replaced with OEM profile blades",
             "Incorrect aftermarket blade profile installed — did not match windshield curvature"),
            ("Water entry at headliner since sunroof drain cleaning",
             "Sunroof drain tube cleaning",
             "Found drain tube kinked during cleaning; replaced tube and re-routed correctly",
             "Drain tube kinked when cleaning probe inserted at wrong angle"),
            ("A/C blowing warm air one day after system recharge",
             "A/C system recharge",
             "Found slow leak at condenser fitting O-ring; replaced O-ring, recharged to spec",
             "O-ring disturbed during recharge connection — system not leak-tested post-service"),
        ],
    }

    # ── Date helper (65% bias toward last 6 weeks) ────────────────────────────
    def _rdate():
        if rng.random() < 0.65:
            days_ago = rng.randint(0, recent_days)
        else:
            days_ago = rng.randint(0, span_days)
        return today - timedelta(days=days_ago)

    # ── Build comeback records ─────────────────────────────────────────────────
    ro_base   = 20001
    to_insert = []
    for idx, (vin, _visit) in enumerate(assignments):
        cb_date   = _rdate()
        orig_date = cb_date - timedelta(days=rng.randint(3, 21))
        tech      = rng.choices(_TECHS, weights=_TECH_W, k=1)[0]
        cat       = rng.choices(_CATS,  weights=_CAT_W,  k=1)[0]
        flag      = rng.choice(_FLAGS)
        vehicle   = vin_vehicle[vin]
        concern, orig_repair, fix, root_cause = rng.choice(_SCRIPTS[cat])
        to_insert.append(models.Comeback(
            comeback_date=cb_date,
            original_repair_date=orig_date,
            ro_number=str(ro_base + idx),
            vin_last7=vin,
            vehicle=vehicle,
            technician_name=tech,
            original_repair=orig_repair,
            comeback_concern=concern,
            repair_category=cat,
            fix_performed=fix,
            root_cause=root_cause,
            flag=flag,
            is_demo=True,
            is_repeat_vin=False,
            logged_by="demo_seed",
        ))
    db.add_all(to_insert)
    db.commit()

    # ── Mark repeat VINs ──────────────────────────────────────────────────────
    for vin in vin_pool:
        recs = (db.query(models.Comeback)
                  .filter(models.Comeback.vin_last7 == vin, models.Comeback.is_demo == True)
                  .all())
        is_repeat = len(recs) > 1
        for r in recs:
            r.is_repeat_vin = is_repeat
    db.commit()

    return {"seeded": db.query(models.Comeback).filter(models.Comeback.is_demo == True).count()}

