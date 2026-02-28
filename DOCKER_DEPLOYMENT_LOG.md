# Docker Deployment Log — Feb 16-17, 2026

## Pre-Deployment Snapshot

### Current running services (before we started)
- `opsyn_copy-db-1` — Postgres 14.4 on port 5432 (from /home/alien/dev/opsyn_copy)
- `opsyn_copy-redis-1` — Redis 7.0.7 on port 6379 (from /home/alien/dev/opsyn_copy)
- Node.js dev server on port 3000 (npm run dev)
- ngrok tunnel → https://johnnie-unnotional-zoey.ngrok-free.dev

### Existing volumes (DO NOT TOUCH)
- `opsyn_copy_postgres_data`
- `opsyn_copy_redis_data`

### Files before we started
- Root `.env` → empty (1 byte)
- `packages/server/api/.env` → local dev config (806 bytes, NOT touched by deployment)
- `opsyn-model-server/.env` → API keys (305 bytes, NOT touched by deployment)
- `docker-compose.yml` → had `image: ghcr.io/activepieces/activepieces:0.71.1`

---

## Deployment Steps

### Step 1: Generate .env file ✅ DONE
**Command:** `sh tools/deploy.sh`
**What it did:** Copied `.env.example` → `.env` and filled in random secrets
**File changed:** Root `.env` (was empty → filled with config)
**Extra changes made:**
- Set `AP_TELEMETRY_ENABLED=false` (was `true`)
- `AP_TEMPLATES_SOURCE_URL` kept as-is (fetches templates from Activepieces cloud)
**Undo:**
```bash
echo "" > /home/alien/dev/activepieces/.env
```

### Step 2: First docker compose attempt ✅ DONE (then undone)
**Command:** `docker compose -p opsyn up -d`
**What happened:** Pulled stock Activepieces image from GitHub — wrong! Was vanilla Activepieces, not OpSyn.
**Undone with:** `docker compose -p opsyn down`

### Step 3: Changed docker-compose.yml to build from local code ✅ DONE
**File changed:** `docker-compose.yml` (in project root: `/home/alien/dev/activepieces/docker-compose.yml`)
**Change:** Line 4 — `image: ghcr.io/activepieces/activepieces:0.71.1` → `build: .`
**Undo:**
```bash
# In docker-compose.yml, change line 4 back:
# FROM: build: .
# TO:   image: ghcr.io/activepieces/activepieces:0.71.1
```

### Step 4: First build attempt ❌ FAILED
**Command:** `docker compose -p opsyn up -d --build`
**What happened:** WSL crashed due to insufficient memory (system was at 62% with opsyn_copy running)
**No cleanup needed** — build never completed, no containers were created

### Step 5: Stop opsyn_copy to free memory ⬜ NEXT
**Commands:**
1. `Ctrl+C` on the npm run dev terminal
2. `Ctrl+C` on the ngrok terminal
3. `cd /home/alien/dev/opsyn_copy && docker compose down`
**What it does:** Stops local dev server, ngrok, and opsyn_copy Docker containers to free RAM
**Undo (to restore opsyn_copy afterwards):**
```bash
cd /home/alien/dev/opsyn_copy
docker compose up -d
# Then start npm run dev and ngrok again in their terminals
```

### Step 6: Build and deploy from local code ⬜ PENDING
**Command:** `cd /home/alien/dev/activepieces && docker compose -p opsyn up -d --build`
**What it does:** Builds Docker image from LOCAL source code (all OpSyn changes) and starts 3 containers
**Resources created:**
- Container: `activepieces` (port 8080)
- Container: `postgres` (internal only)
- Container: `redis` (internal only)
- Volume: `opsyn_postgres_data`
- Volume: `opsyn_redis_data`
- Directory: `./cache`
**Undo:**
```bash
cd /home/alien/dev/activepieces
docker compose -p opsyn down
```

### Step 7: (Optional) Set up ngrok for webhooks
**Command:** `ngrok http 8080`
**What it does:** Creates public tunnel to the dockerized app
**Then:** Update `AP_FRONTEND_URL` in `.env` to the ngrok URL and restart
**Undo:** Ctrl+C to stop ngrok

---

## Full Rollback (undo EVERYTHING back to before we started)

```bash
cd /home/alien/dev/activepieces

# 1. Stop and remove all deployment containers + volumes
docker compose -p opsyn down -v

# 2. Restore empty .env
echo "" > .env

# 3. Restore docker-compose.yml (change line 4)
# FROM: build: .
# TO:   image: ghcr.io/activepieces/activepieces:0.71.1

# 4. Remove cache directory if created
rm -rf cache/

# 5. Restart opsyn_copy (if it was stopped)
cd /home/alien/dev/opsyn_copy
docker compose up -d
# Then start npm run dev and ngrok again
```

This restores everything to exactly how it was before we started.
`packages/server/api/.env` and `opsyn-model-server/.env` were NEVER touched.
