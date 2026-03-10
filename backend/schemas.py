from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str  # "manager" or "advisor"

class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    class Config:
        from_attributes = True

class TechnicianCreate(BaseModel):
    name: str
    role: Optional[str] = "Technician"
    is_active: bool = True

class TechnicianOut(BaseModel):
    id: int
    name: str
    role: str
    is_active: bool
    class Config:
        from_attributes = True

class ComebackCreate(BaseModel):
    comeback_date: date
    original_repair_date: Optional[date] = None
    ro_number: Optional[str] = None
    vin_last7: Optional[str] = None
    vehicle: Optional[str] = None
    technician_name: str
    original_repair: Optional[str] = None
    comeback_concern: Optional[str] = None
    repair_category: Optional[str] = None
    fix_performed: Optional[str] = None
    root_cause: Optional[str] = None
    notes: Optional[str] = None

class ComebackUpdate(BaseModel):
    comeback_date: Optional[date] = None
    original_repair_date: Optional[date] = None
    ro_number: Optional[str] = None
    vin_last7: Optional[str] = None
    vehicle: Optional[str] = None
    technician_name: Optional[str] = None
    original_repair: Optional[str] = None
    comeback_concern: Optional[str] = None
    repair_category: Optional[str] = None
    fix_performed: Optional[str] = None
    root_cause: Optional[str] = None
    notes: Optional[str] = None

class ComebackOut(BaseModel):
    id: int
    comeback_date: date
    original_repair_date: Optional[date]
    ro_number: Optional[str]
    vin_last7: Optional[str]
    vehicle: Optional[str]
    technician_name: str
    original_repair: Optional[str]
    comeback_concern: Optional[str]
    repair_category: Optional[str]
    fix_performed: Optional[str]
    root_cause: Optional[str]
    notes: Optional[str]
    is_repeat_vin: bool
    is_demo: bool
    logged_by: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# --- Loaners ---
class LoanerCreate(BaseModel):
    unit_number: str
    vin: Optional[str] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    license_plate: Optional[str] = None
    current_miles: Optional[int] = None
    current_fuel: Optional[str] = None
    status: Optional[str] = "available"

class LoanerCheckout(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    ro_number: Optional[str] = None
    advisor_name: Optional[str] = None
    checkout_date: date
    checkout_miles: Optional[int] = None
    checkout_fuel: Optional[str] = None
    checkout_notes: Optional[str] = None

class LoanerCheckin(BaseModel):
    checkin_date: date
    checkin_miles: Optional[int] = None
    checkin_fuel: Optional[str] = None
    checkin_notes: Optional[str] = None
    damage_noted: bool = False
    damage_notes: Optional[str] = None

class LoanerOut(BaseModel):
    id: int
    unit_number: str
    vin: Optional[str]
    year: Optional[int]
    make: Optional[str]
    model: Optional[str]
    color: Optional[str]
    license_plate: Optional[str]
    current_miles: Optional[int]
    current_fuel: Optional[str]
    status: str
    customer_name: Optional[str]
    customer_phone: Optional[str]
    ro_number: Optional[str]
    advisor_name: Optional[str]
    checkout_date: Optional[date]
    checkout_miles: Optional[int]
    checkout_fuel: Optional[str]
    checkout_notes: Optional[str]
    checkin_date: Optional[date]
    checkin_miles: Optional[int]
    checkin_fuel: Optional[str]
    checkin_notes: Optional[str]
    damage_noted: bool
    damage_notes: Optional[str]
    class Config:
        from_attributes = True
