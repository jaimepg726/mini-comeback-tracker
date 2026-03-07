#!/bin/bash
echo "Starting MINI Comeback Tracker..."

# Start backend
cd backend
pip install -r requirements.txt -q
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend running (PID $BACKEND_PID)"

# Start frontend
cd ../frontend
npm install --silent
npm start &
FRONTEND_PID=$!
echo "Frontend starting..."
echo ""
echo "App will be available at: http://localhost:3000"
echo "API docs at: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
