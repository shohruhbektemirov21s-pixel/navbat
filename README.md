# NavbatBor — Professional Online Booking & Digital Queue System

> **O‘zbekistonda professional onlayn booking, elektron navbat va biznes jarayonlarini avtomatlashtirish platformasi.**

---

## 🏛️ Arxitektura va Texnologiyalar

Loyiha zamonaviy mikroxizmatlarga mos, toza (Clean Architecture) va modulli arxitektura asosida ishlab chiqilgan:

```
navbatbor/
├── backend/                  # Python Django REST Framework (DRF)
│   ├── navbat_backend/       # Django asosiy konfiguratsiyasi (settings, urls, asgi, wsgi)
│   ├── apps/
│   │   ├── authentication/   # Custom User, JWT tokenlar, RBAC ruxsatlar, Telegram auth
│   │   ├── core/             # Tizim audit loglari, monitoring, sog‘liq tekshiruvi
│   │   ├── marketplace/      # Tashkilotlar, kategoriyalar, shaharlar, xizmatlar, xodimlar, sharhlar
│   │   ├── bookings/         # Onlayn bron qilish, real-vaqt oraliqlari (Asia/Tashkent), taqvim
│   │   ├── queues/           # Elektron navbat, QR orqali ro'yxatdan o'tish, jonli TV doska
│   │   ├── partners/         # Boshqaruvchi hamkor (Operating Partner), CRM lidlar, komissiyalar
│   │   ├── subscriptions/    # Tarif rejalari, to'lovlar, 14 kunlik bepul sinov, reklama
│   │   ├── support/          # Mijozlar va hamkorlar qo'llab-quvvatlash tizimi
│   │   └── notifications/    # Telegram bot xabarnomalari, tizim bildirishnomalari
│   ├── manage.py
│   └── requirements.txt
│
├── src/                      # Frontend (React 19 + TypeScript)
│   ├── components/           # UI komponentlar, modallar, boshqaruv panellari
│   ├── hooks/                # Maxsus hooklar (Telegram WebApp, geolokatsiya)
│   ├── i18n/                 # Ko'p tillilik tizimi (O'zbek, Rus, Ingliz)
│   ├── utils/                # Yordamchi hisob-kitob va eksport funksiyalari
│   ├── api.ts                # Markazlashtirilgan backend REST API mijozi (Typed fetch)
│   └── types.ts              # TypeScript turlari va interfeyslari
│
├── start.sh                  # Bir tugma bilan backend va frontendni ishga tushirish skripti
├── package.json
└── vite.config.ts            # Vite 8 konfiguratsiyasi (/api -> Django proksi)
```

---

## 🔒 Xavfsizlik va Ma'lumotlar oqimi

1. **JWT Autentifikatsiya:** Barcha so'rovlar `Bearer <token>` orqali himoyalangan.
2. **Rolga asoslangan kirish (RBAC):** `FOUNDER`, `ADMIN`, `OPERATING_PARTNER`, `SALES_MANAGER`, `SUPPORT`, `BUSINESS_OWNER`, `STAFF`, `CUSTOMER`.
3. **Ma'lumotlar yaxlitligi:** Barcha ma'lumotlar (hech qanday mock yoki static data'siz) to'g'ridan-to'g'ri Django REST API va SQLite ma'lumotlar bazasidan keladi.
4. **Vaqt mintaqasi:** O'zbekiston (`Asia/Tashkent`, UTC+5) vaqti qat'iy nazorat qilinadi.

---

## 🚀 Ishga tushirish

### 1. Talablar:
* Python 3.10+
* Node.js 18+ va npm

### 2. Muhit o'zgaruvchilari:
Loyiha ildizida `.env` faylini yarating (`.env.example` namunasi bo'yicha). Muhim o'zgaruvchilar:

| O'zgaruvchi | Tavsif |
| :--- | :--- |
| `DJANGO_DEBUG` | `True` — lokal ishlab chiqish, `False` — production (shart) |
| `DJANGO_SECRET_KEY` | `DEBUG=False` bo'lsa majburiy, uzun tasodifiy qiymat |
| `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | vergul bilan ajratilgan ro'yxat |
| `DATABASE_URL` | bo'sh — SQLite (dev), `postgres://user:pass@host:5432/db` — production |
| `ALLOW_DEV_QUICK_LOGIN` | faqat `DEBUG=True` da telefon orqali tezkor kirishni yoqadi |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Telegram bot integratsiyasi uchun |

### 3. Tezkor ishga tushirish (dasturlash rejimi):
```bash
./start.sh
```

Yoki alohida terminallarda:
```bash
# Backend (Django REST Framework):
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data          # faqat DEBUG=True da (demo ma'lumotlar)
python manage.py runserver 0.0.0.0:8000

# Frontend (React + Vite):
npm install
npm run dev
```

### 4. Telegram bot (xabarnomalar va `/start auth_..` / `link_..` havolalari):
```bash
cd backend && source venv/bin/activate
python manage.py telegram_bot       # long-polling rejimi
```
Webhook rejimi kerak bo'lsa, `POST /api/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET>` manzilini botga ulang.

### 5. Testlar:
```bash
cd backend && source venv/bin/activate
python manage.py test apps
```

### 6. Production (misol):
```bash
cd backend && source venv/bin/activate
pip install -r requirements.txt
DJANGO_DEBUG=False DJANGO_SECRET_KEY=... DATABASE_URL=postgres://... \
  python manage.py migrate
DJANGO_DEBUG=False DJANGO_SECRET_KEY=... DATABASE_URL=postgres://... \
  python manage.py collectstatic --noinput
DJANGO_DEBUG=False DJANGO_SECRET_KEY=... DATABASE_URL=postgres://... \
  gunicorn navbat_backend.wsgi:application --bind 0.0.0.0:8000
```
Statik fayllar `whitenoise` orqali to'g'ridan-to'g'ri gunicorn ichidan xizmat qiladi.

---

## 🔑 Sinov uchun hisoblar (Email / Parol)

| Rol | Email | Parol | Tavsif |
| :--- | :--- | :--- | :--- |
| **Founder** | `rasulovjahongir074@gmail.com` | `admin123` | Tizim asoschisi, to'liq super boshqaruv |
| **Admin** | `admin@navbatbor.uz` | `admin123` | Bosh administrator |
| **Boshqaruvchi hamkor** | `partner@navbatbor.uz` | `partner123` | Qarshi shahri koordinatori va CRM |
| **Biznes egasi** | `owner@navbatbor.uz` | `owner123` | Nasaf Stomatologiya egasi |
| **Xodim (Shifokor)** | `staff@navbatbor.uz` | `staff123` | Xizmat ko'rsatuvchi mutaxassis |
| **Mijoz** | `mijoz@navbatbor.uz` | `mijoz123` | Xizmatlardan foydalanuvchi mijoz |

---

## 📱 Asosiy Manzillar
- **Mijoz va Boshqaruv paneli:** [http://localhost:3000](http://localhost:3000)
- **Django REST API:** [http://localhost:8000/api/](http://localhost:8000/api/)
- **Django Admin:** [http://localhost:8000/admin/](http://localhost:8000/admin/)
