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

class TechnicianOut(BaseModel):
    id: int
    name: str
    role: str
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
    logged_by: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True
