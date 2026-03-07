# MINI Comeback Tracker
### MINI of Fairfield County — Service Department

A full-stack web app for tracking technician comebacks, detecting repeat VINs, and reporting on shop quality trends.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Recharts |
| Backend | Python FastAPI |
| Database | SQLite (local file) |
| Auth | JWT (bcrypt passwords) |

---

## Prerequisites

Install these before running:

1. **Python 3.9+** — https://www.python.org/downloads/
2. **Node.js 18+** — https://nodejs.org/
3. **pip** (comes with Python)

---

## Quick Start

### Mac / Linux

```bash
chmod +x start.sh
./start.sh
```

### Windows

Double-click `start.bat` or run in Command Prompt:
```
start.bat
```

### Manual (any OS)

**Terminal 1 — Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm start
```

---

## Access the App

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Main app (open in browser/iPad) |
| http://localhost:8000/docs | API documentation (FastAPI Swagger) |

---

## Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Manager | `manager` | `mini1234` |
| Advisor | `advisor` | `advisor1234` |

> **Change these** in `backend/main.py` under `seed_defaults()` before deploying.

---

## Using on iPad / iPhone

1. Start the app on your Mac (or a shared computer on the same WiFi network).
2. Find your computer's local IP address:
   - Mac: System Settings → Network → Wi-Fi → Details
   - Windows: `ipconfig` in Command Prompt → look for IPv4 Address
3. Open Safari on iPad and navigate to: `http://YOUR-IP:3000`
4. Tap **Share → Add to Home Screen** for a native-like icon.

---

## Features

### Advisor Workflow
- Log a comeback quickly using the **Log Comeback** form
- Required fields: Date, Vehicle, Technician, Category, Concern
- VIN Last 7 triggers automatic repeat detection

### Manager Workflow
- All advisor fields plus Fix Performed, Root Cause, Notes
- Delete records from the Comeback Log
- View Dashboard and Weekly Report

### Repeat VIN Detection
- Automatic — no configuration needed
- Any VIN appearing more than once is flagged **REPEAT VIN** across all records
- Visible in the log, dashboard, and weekly report

### Dashboard
- Total comeback count
- Last 30 days activity
- Repeat VIN count
- Comebacks by technician (bar chart)
- Top comeback causes (horizontal bar chart)
- Per-technician status (Clean / Monitor / Review)

### Weekly Report
- Rolling 7-day window
- Comebacks by tech and category
- Repeat VIN list highlighted

---

## Customization

### Add / Change Technicians

Option A — Through the seeded defaults in `backend/main.py`:
```python
techs = ["Jake", "Ernie", "Jeisson", "Michael", "Aaron"]
```
Edit this list and restart the backend (only adds new names, won't duplicate).

Option B — Via the API at `http://localhost:8000/docs` → POST /technicians (manager token required).

### Add / Change Users

Edit `seed_defaults()` in `backend/main.py`:
```python
crud.create_user(db, schemas.UserCreate(
    username="myles", password="yourpassword",
    full_name="Myles", role="advisor"
))
```

### Change Comeback Categories

Edit the `CATEGORIES` list in both:
- `backend/crud.py`
- `frontend/src/pages/ComebackEntry.js`

---

## Data Storage

The database file `backend/comeback_tracker.db` (SQLite) stores all data locally.
Back it up regularly by copying this file.

To reset all data: delete `comeback_tracker.db` and restart the backend.

---

## Deploying for Remote Access (Optional)

To make this accessible outside your local network (e.g., from a customer's device or from home):

1. Deploy the backend to a VPS (e.g., DigitalOcean, Railway, Render)
2. Build the frontend: `cd frontend && npm run build`
3. Set the API URL in frontend via environment variable:
   ```
   REACT_APP_API_URL=https://your-backend-url.com
   ```
4. Serve the `build/` folder with nginx or any static host.

---

## Project Structure

```
mini-comeback-app/
├── backend/
│   ├── main.py          # FastAPI app + routes
│   ├── models.py        # SQLAlchemy database models
│   ├── schemas.py       # Pydantic request/response models
│   ├── crud.py          # Database logic + repeat VIN detection
│   ├── database.py      # SQLite connection
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js
│   │   │   ├── ComebackEntry.js
│   │   │   ├── ComebackLog.js
│   │   │   └── WeeklyReport.js
│   │   ├── components/
│   │   │   └── Layout.js
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
├── start.sh             # Mac/Linux launcher
├── start.bat            # Windows launcher
└── README.md
```
