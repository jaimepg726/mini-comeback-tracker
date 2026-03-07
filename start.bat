@echo off
echo Starting MINI Comeback Tracker...

cd backend
pip install -r requirements.txt
start "Backend" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

cd ..\frontend
npm install
start "Frontend" cmd /k "npm start"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API docs: http://localhost:8000/docs
echo.
pause
