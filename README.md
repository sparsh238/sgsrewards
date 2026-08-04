# SGS Rewards

Dealer loyalty & rewards platform for SGS (electronics/consumer-durables distribution).

## Structure
- `backend/` — Node/Express + TypeScript API, MongoDB (Mongoose). Copy `backend/.env.example` → `backend/.env` and fill in.
- `frontend/` — SGS Rewards app (React + Vite + TypeScript). Dealer + admin/superadmin UI.
- `legacy-loyalty-app-front/` — previous frontend, kept for reference.

## Run
```
cd backend && npm install && npm run dev      # API on :8000
cd frontend && npm install && npm run dev      # app on :5173
```

Tiers, points and the dealer progress bars are driven by System settings (superadmin).
