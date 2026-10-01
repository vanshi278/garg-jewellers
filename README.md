# Garg Jewellers — 925 Sterling Silver Store

E-commerce for Garg Jewellers, Jhansi: a customer storefront with virtual
try-on and an owner console, built on a **FastAPI** backend and a **Next.js**
frontend.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router, TS), Tailwind v4 |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| DB | PostgreSQL (prod) · SQLite (dev default) |
| Auth | JWT (access + refresh), owner/customer roles |
| Payments | Razorpay (mock mode until keys added) |
| Try-on | MediaPipe FaceLandmarker (in-browser) |
| Notifications | Email (SMTP), SMS (MSG91), WhatsApp (Cloud API) — log-only until keys added |

## Local development

**Backend** (http://localhost:8000, docs at `/docs`):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed          # load sample catalogue
uvicorn app.main:app --reload
```

**Frontend** (http://localhost:3000):

```bash
cd frontend
npm install
npm run dev
```

Default accounts (from `backend/.env`):
- **Owner** → `/admin/login` · `owner@gargjewellers.in` / `change-me-owner`
- **Test customer** → `buyer@example.com` / `secret123` (after seeding)

## Production (Docker)

Brings up Postgres + backend + frontend:

```bash
# Set real secrets first (see docker-compose.yml env vars)
docker compose up --build
```

Then load sample data once (optional):

```bash
docker compose exec backend python -m app.seed
```

**Before going live**, set these as real values (env vars / `.env`):
- `SECRET_KEY` — a long random string (`python -c "import secrets;print(secrets.token_hex(32))"`)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — live checkout
- `SMTP_*`, `MSG91_AUTH_KEY`, `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` — live notifications
- `NEXT_PUBLIC_API_BASE` + `PUBLIC_BASE_URL` — your public API domain (must be
  reachable from the browser; it's baked into the frontend bundle at build time)

## Database migrations (Alembic)

Schema changes are versioned with Alembic (the backend container runs
`alembic upgrade head` on start).

```bash
cd backend
alembic upgrade head                         # apply migrations
alembic revision --autogenerate -m "message" # after changing models
```

## Project layout

```
backend/
  app/
    models/       SQLAlchemy models (catalogue, user, cart, order, contact)
    schemas/      Pydantic request/response schemas
    routers/      API endpoints (catalogue, auth, cart, orders, contact, admin, uploads)
    services/     payments (Razorpay), notifications (email/SMS/WhatsApp)
    core/         security (JWT, hashing), deps (auth guards)
  alembic/        migrations
  uploads/        uploaded product images (gitignored; volume-mounted in Docker)
frontend/
  src/app/        pages (storefront + /admin console)
  src/components/ UI (Header, BottomNav, ProductGallery, LiveTryOn, CameraCapture, …)
  src/lib/        api client, auth/cart/config contexts, types
```
