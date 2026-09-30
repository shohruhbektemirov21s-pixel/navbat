#!/bin/bash
# NavbatBor — Professional Full-Stack Architecture
# Backend: Python Django REST Framework (Port 8000)
# Frontend: React 19 + TypeScript + Vite + Tailwind CSS (Port 3000)

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "🚀 NavbatBor Platformasini ishga tushirish..."
echo "=========================================================="

# 1. Start Django Backend
echo "⚙️ Django backend ishga tushirilmoqda (http://127.0.0.1:8000)..."
"$DIR/backend/venv/bin/python" "$DIR/backend/manage.py" runserver 0.0.0.0:8000 &
BACKEND_PID=$!

# Wait for backend
sleep 2

# 2. Start Vite Frontend
echo "💻 Vite React TypeScript frontend ishga tushirilmoqda (http://localhost:3000)..."
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo ""
echo "✅ Tizim to'liq ishga tushdi!"
echo "👉 Frontend (Mijoz & Boshqaruv paneli): http://localhost:3000"
echo "👉 Backend API (Django REST Framework): http://localhost:8000/api/"
echo "👉 Django Admin paneli:                 http://localhost:8000/admin/"
echo "To'xtatish uchun: Ctrl+C"
echo ""

wait
