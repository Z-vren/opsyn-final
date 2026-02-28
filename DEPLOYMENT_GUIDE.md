# OpSyn — Docker Deployment Guide

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- [Docker Compose v2](https://docs.docker.com/compose/install/) (comes with Docker Desktop)
- At least **8 GB of free RAM** (the build is memory-intensive)
- Make sure nothing else heavy is running during the build

## Step 1: Navigate to the project

```bash
cd /path/to/your/opsyn-project
```

## Step 2: Update docker-compose.yml to build from local code

Open the file `docker-compose.yml` in the **project root** (e.g. `/home/you/dev/opsyn/docker-compose.yml`).

Find this line under the `activepieces` service (line 4):

```yaml
    image: ghcr.io/activepieces/activepieces:0.71.1
```

Replace it with:

```yaml
    build: .
```

**Why:** By default, `docker-compose.yml` pulls a pre-built Activepieces image from GitHub — that's the stock app, not OpSyn. Changing it to `build: .` tells Docker to build the image from your local `Dockerfile` and source code, so all your OpSyn customizations (branding, AI workflow generation, model server integration, etc.) are included.

> **Note:** This is the only file you need to edit. Do NOT modify `Dockerfile`, `docker-entrypoint.sh`, `nginx.react.conf`, or `.dockerignore`.

## Step 3: Generate environment variables

This creates a `.env` file with random passwords and secrets:

```bash
sh tools/deploy.sh
```

You should see:
```
A .env file containing random passwords and secrets has been successfully generated.
```

### (Recommended) Disable telemetry

Open the generated `.env` file and change:
```
AP_TELEMETRY_ENABLED=false
```

## Step 4: Build and start

```bash
docker compose -p opsyn up -d --build
```

This will:
1. Build the Docker image from the local source code (takes 5-15 minutes on first run)
2. Start 3 containers: the app, Postgres, and Redis
3. Run database migrations automatically

Once done, the app is live at: **http://localhost:8080**

The first account you create will be the admin.

## Step 5: (Optional) Set up ngrok for public access

If you want webhooks and triggers to work (e.g. "When I receive a new email"), external services need to reach your app. Install [ngrok](https://ngrok.com/download), then:

```bash
ngrok http 8080
```

Copy the ngrok URL (e.g. `https://xxxx.ngrok-free.dev`), then:

1. Open `.env`
2. Change `AP_FRONTEND_URL=http://localhost:8080` to `AP_FRONTEND_URL=https://xxxx.ngrok-free.dev`
3. Restart the app:
```bash
docker compose -p opsyn down
docker compose -p opsyn up -d
```

## Managing the deployment

### Check status
```bash
docker ps
```

### View logs
```bash
docker compose -p opsyn logs -f            # all services
docker compose -p opsyn logs -f activepieces  # app only
```

### Stop (keeps data)
```bash
docker compose -p opsyn down
```

### Start again
```bash
docker compose -p opsyn up -d
```

### Stop and delete all data (fresh start)
```bash
docker compose -p opsyn down -v
```

### Rebuild after code changes
```bash
docker compose -p opsyn up -d --build
```

## Troubleshooting

### Build fails / WSL crashes
The build needs a lot of RAM. Make sure:
- Close other heavy applications
- Stop any other Docker containers: `docker stop $(docker ps -q)`
- If using WSL, increase memory limit in `C:\Users\<you>\.wslconfig`:
  ```
  [wsl2]
  memory=12GB
  ```
  Then restart WSL: `wsl --shutdown`

### Port 8080 already in use
Change the port in `docker-compose.yml`:
```yaml
ports:
  - '9090:80'   # change 8080 to whatever you want
```
Also update `AP_FRONTEND_URL` in `.env` to match.

## Architecture

| Container | Purpose |
|---|---|
| `activepieces` | OpSyn app — Nginx (frontend) + Node.js (backend API) on port 8080 |
| `postgres` | PostgreSQL 14.4 database (internal, not exposed to host) |
| `redis` | Redis 7 cache/queue (internal, not exposed to host) |

The AI model server runs separately on Modal cloud — the app calls it automatically when generating workflows.
