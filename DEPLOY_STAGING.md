# SGS Rewards — Staging deploy (Hostinger VPS)

> ✅ **LIVE at https://staging.sgsrewards.in** (DNS + reverse proxy + Let's Encrypt SSL all set up). Redeploy code with `./deploy-staging.sh`.


A throwaway, isolated copy of the app for live testing, on its own subdomain
**https://staging.sgsrewards.in**. Completely separate from production:

| | Production | Staging |
|---|---|---|
| Frontend | `sgsrewards.in` | `staging.sgsrewards.in` |
| Backend API | `api.sgsrewards.in` | same origin — `staging.sgsrewards.in/api` |
| Server dir | (prod) | `/home/loyalty-staging` |
| Container port | (prod) | `127.0.0.1:8090` |

The staging build is **one container**: the Node API and the built SPA are served
from the same origin, so the frontend calls relative `/api` paths (no CORS, one
reverse-proxy target). Secrets (`/home/loyalty-staging/.env.staging`) live only on
the VPS — never synced or committed.

> ⚠️ **Database:** staging currently points at the **same loyalty DB as production**
> (`MONGO_URI`). It's live data — test *reads* are safe, but test *redemptions/cancels*
> mutate real balances/orders. Swap `MONGO_URI` in `.env.staging` for an isolated copy
> if you want a sandbox.

VPS: **82.112.236.6** (srv581921.hstgr.cloud), CloudPanel / Ubuntu, SSH `root@`.

---

## Deploy / redeploy (from this repo on your Mac)
```bash
./deploy-staging.sh
```
Syncs source, builds the image on the VPS, restarts the container, and prints
`healthz: {"ok":true,"db":true}`. Re-run any time to push new code.

`.env.staging` is created once on the VPS (see below) and is **not** touched by redeploys.

---

## ONE-TIME SETUP

### 1. `.env.staging` on the VPS
Created by the deploy step from your local `backend/.env` values (MONGO_URI, JWT_*,
API_KEY) plus `CORS_ORIGINS=https://staging.sgsrewards.in`. It sits at
`/home/loyalty-staging/.env.staging`, chmod 600. Edit there to point at a different DB.

### 2. DNS — point the subdomain at the VPS  *(you, in your DNS provider)*
| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `staging` | `82.112.236.6` | default |

Leaves the root domain (production) alone. After a few minutes,
`ping staging.sgsrewards.in` should resolve to 82.112.236.6.

### 3. CloudPanel — HTTPS reverse proxy  *(you, in CloudPanel)*
1. **Sites → Add Site → Create a Reverse Proxy**
   - Domain: `staging.sgsrewards.in`
   - Reverse Proxy URL: `http://127.0.0.1:8090`
2. Open the site → **SSL/TLS → Actions → New Let's Encrypt Certificate** (needs DNS from step 2 to be live).
3. Turn on **Force HTTPS**.

Visit **https://staging.sgsrewards.in** — the dealer login should load. Done.

---

## Notes
- Dealers log in with phone + PIN (all reset to **1234**); staff via the "Staff login" link.
- `GET /healthz` (no auth) → `{"ok":true,"db":true}` for probes.
- Billing sync isn't wired yet, so the overview shows ₹0 until that lands — expected.
- To stop staging: `ssh root@82.112.236.6 'cd /home/loyalty-staging && docker compose -f docker-compose.staging.yml down'`.
