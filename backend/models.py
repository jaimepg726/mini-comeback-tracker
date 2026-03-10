from sqlalchemy import Column, Integer, String, Date, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    role = Column(String)  # "manager" or "advisor"
    hashed_password = Column(String)

class Technician(Base):
    __tablename__ = "technicians"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    role = Column(String, default="Technician")
    is_active = Column(Boolean, default=True, nullable=False)
    comebacks = relationship("Comeback", back_populates="technician_rel")

class Comeback(Base):
    __tablename__ = "comebacks"
    id = Column(Integer, primary_key=True, index=True)
    comeback_date = Column(Date, nullable=False)
    original_repair_date = Column(Date, nullable=True)
    ro_number = Column(String, nullable=True)
    vin_last7 = Column(String(7), nullable=True)
    vehicle = Column(String, nullable=True)
    technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=True)
    technician_name = Column(String, nullable=False)
    original_repair = Column(Text, nullable=True)
    comeback_concern = Column(Text, nullable=True)
    repair_category = Column(String, nullable=True)
    fix_performed = Column(Text, nullable=True)
    root_cause = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_repeat_vin = Column(Boolean, default=False)
    is_demo = Column(Boolean, default=False, nullable=False)
    logged_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    technician_rel = relationship("Technician", back_populates="comebacks")
