# Activepieces (OpSyn) Architecture - Complete Beginner-Friendly Guide

This document explains EVERYTHING about how Activepieces works, written so that anyone can understand it. Every diagram is explained in plain English.

---

## Table of Contents

1. [What Is Activepieces?](#1-what-is-activepieces)
2. [The Big Picture](#2-the-big-picture)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Tech Stack](#4-tech-stack)
5. [How Flows Work](#5-how-flows-work)
6. [Pieces (Integrations)](#6-pieces-integrations)
7. [Flow Execution Pipeline](#7-flow-execution-pipeline)
8. [Trigger System](#8-trigger-system)
9. [All Backend Services](#9-all-backend-services)
10. [API Server & Request Pipeline](#10-api-server--request-pipeline)
11. [Authentication & Users](#11-authentication--users)
12. [Projects, Platforms & Permissions](#12-projects-platforms--permissions)
13. [Real-Time Collaboration & Socket.IO](#13-real-time-collaboration--socketio)
14. [Tables (Built-in Database)](#14-tables-built-in-database)
15. [AI / OpSyn Model Server (FastAPI + Python)](#15-ai--opsyn-model-server-fastapi--python)
16. [MCP (Model Context Protocol)](#16-mcp-model-context-protocol)
17. [Worker & Queue System](#17-worker--queue-system)
18. [Frontend Architecture](#18-frontend-architecture)
19. [Database Schema](#19-database-schema)
20. [Enterprise Edition](#20-enterprise-edition)
21. [End-to-End: Everything Connected](#21-end-to-end-everything-connected)

---

## 1. What Is Activepieces?

Imagine you want: "Every time someone fills out a Google Form, automatically send them a Slack message and add them to a Google Sheet."

Activepieces lets you build that **without writing code**. You drag and drop blocks (called "pieces") on a visual canvas, connect them together, and click publish. That's a "flow."

It's like Zapier or Make.com, but open-source and self-hosted.

Your fork (OpSyn) adds an AI feature: you can **type what you want in plain English** and the AI generates the entire flow for you.

---

## 2. The Big Picture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  React UI    │  │  API Keys    │  │  MCP Clients (Claude, etc.)  │  │
│  │  (Vite SPA)  │  │  (REST API)  │  │                              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬───────────────┘  │
└─────────┼─────────────────┼─────────────────────────┼──────────────────┘
          │ HTTP + WS       │ HTTP                    │ SSE/HTTP
          ▼                 ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FASTIFY API SERVER (:3000)                            │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐             │
│  │ Auth (JWT)  │ │ REST API │ │ Socket.IO│ │ MCP Server │             │
│  │ RBAC        │ │ Routes   │ │ (Collab) │ │            │             │
│  └─────────────┘ └──────────┘ └──────────┘ └────────────┘             │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │  Services: Flows, Runs, Projects, Users, Triggers, AI...   │       │
│  └─────────────────────────────────────────────────────────────┘       │
└──────────┬──────────────┬──────────────┬───────────────┬───────────────┘
           │              │              │               │
     ┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐  ┌────▼────────────┐
     │PostgreSQL │  │  Redis  │  │   Worker    │  │ OpSyn Model     │
     │ (Data)    │  │(Queue + │  │  (BullMQ)   │  │ Server (Python) │
     │           │  │ PubSub) │  │             │  │ Qwen2.5-7B      │
     └───────────┘  └─────────┘  └──────┬──────┘  └─────────────────┘
                                        │
                                  ┌─────▼──────┐
                                  │  Engine    │
                                  │ (Sandbox)  │
                                  │ Executes   │
                                  │ Flow Steps │
                                  └────────────┘
```

### What this diagram means (reading top to bottom):

**Top section - CLIENTS**: These are the things that talk to your server.
- **React UI**: The web app you open in your browser. Built with React and served by Vite.
- **API Keys**: External programs or scripts that call your API directly (no browser needed).
- **MCP Clients**: AI assistants like Claude Desktop or Cursor that can use your Activepieces tools.

**Middle section - FASTIFY API SERVER**: This is the brain. It's a single Node.js application running on port 3000 that handles everything:
- **Auth (JWT)**: Checks who you are when you make a request (using JSON Web Tokens).
- **REST API Routes**: All the HTTP endpoints (like `GET /v1/flows`, `POST /v1/authentication/sign-in`, etc.).
- **Socket.IO (Collab)**: A persistent connection between your browser and the server for real-time features (explained in detail in section 13).
- **MCP Server**: Exposes your pieces and flows as tools for AI models.
- **Services**: The business logic - code that knows how to create flows, run them, manage users, etc.

**Bottom section - Data & Workers**:
- **PostgreSQL**: The main database. Stores everything: users, projects, flows, runs, connections, tables.
- **Redis**: A fast in-memory store used for two things: (1) job queues (BullMQ puts jobs here, workers pick them up), (2) pub/sub messaging (Socket.IO uses this so multiple server instances can talk to each other).
- **Worker (BullMQ)**: A background process that executes flows. When a trigger fires, a job goes into Redis. The worker picks it up and runs the flow.
- **OpSyn Model Server**: A separate Python server (FastAPI) running a fine-tuned AI model that generates workflow JSON from natural language.
- **Engine (Sandbox)**: The actual code that executes each step in a flow. It runs in a separate process for security - if user code crashes, it doesn't take down the whole server.

---

## 3. Monorepo Structure

A "monorepo" means all the code lives in one repository but is split into separate packages.

```
activepieces/
├── packages/
│   ├── react-ui/           # The website you see in your browser
│   ├── server/
│   │   ├── api/            # The backend API (receives HTTP requests)
│   │   ├── worker/         # Background job processor
│   │   └── shared/         # Code shared between api and worker
│   ├── engine/             # Executes flow steps in a sandbox
│   ├── shared/             # Code shared between frontend AND backend
│   ├── pieces/
│   │   └── community/      # ~465 integration plugins
│   ├── ee/                 # Enterprise-only features
│   ├── cli/                # Command-line tool for managing pieces
│   └── tests-e2e/          # Automated browser tests
├── opsyn-model-server/     # Python AI server
├── activepieces_embedding_model/  # Trained embedding model files
└── deploy/                 # Infrastructure code
```

**Why split like this?**
- `packages/shared/` has TypeScript types and utilities used by BOTH the frontend and backend. For example, the `Flow` type definition is here - both the React app and the Fastify server import it.
- `packages/server/shared/` has code only the server side uses (api + worker), like database helpers.
- The engine is separate because it runs in an isolated process.

**Build tools:**
- **Nx**: Manages the monorepo. Knows which packages depend on which, runs builds in the right order, caches results.
- **Bun**: The package manager (like npm but faster).
- **Vite**: Builds the React frontend.
- **esbuild**: Builds the Fastify backend.
- **Webpack**: Builds the engine into a single file.

---

## 4. Tech Stack

| What | Technology | Why |
|------|-----------|-----|
| Language | TypeScript (entire codebase) | Type safety, shared code between FE+BE |
| Frontend framework | React 18 | Component-based UI |
| Frontend build tool | Vite | Fast dev server, fast builds |
| Frontend styling | Tailwind CSS + shadcn/ui | Utility-first CSS + pre-built components |
| Flow canvas | React Flow (@xyflow/react) | Visual node/edge graph editor |
| Frontend state | Zustand (local) + TanStack Query (server) | Simple state management |
| Backend framework | Fastify 5 | Fast HTTP server for Node.js |
| Database ORM | TypeORM | Maps TypeScript objects to SQL |
| Primary database | PostgreSQL 14 | Reliable relational database |
| Dev database option | SQLite | Simpler for local development |
| Cache & queue | Redis 7 | Fast in-memory data store |
| Job queue | BullMQ | Reliable job queue built on Redis |
| Real-time | Socket.IO | WebSocket wrapper with rooms and events |
| AI model | Qwen2.5-Coder-7B + LoRA | Fine-tuned code generation model |
| AI server | FastAPI (Python) | Python web framework for ML serving |
| AI deployment | Modal | Serverless GPU hosting |
| Validation | TypeBox (@sinclair/typebox) | JSON Schema validation |
| API docs | Swagger/OpenAPI | Auto-generated API documentation |

---

## 5. How Flows Work

### What is a Flow?

A flow is like a recipe: "When THIS happens, do THAT, then do THAT."

Every flow has exactly ONE trigger (the "when") and one or more actions (the "do"):

```
Example: "When I get a new email, save it to a spreadsheet and notify me on Slack"

┌──────────────┐     ┌─────────────────┐     ┌────────────────┐
│  TRIGGER     │     │  ACTION 1       │     │  ACTION 2      │
│              │     │                 │     │                │
│  New Email   │────▶│  Add Row to     │────▶│  Send Slack    │
│  (Gmail)     │     │  Google Sheets  │     │  Message       │
└──────────────┘     └─────────────────┘     └────────────────┘
```

### Flow Lifecycle

```
┌──────────────────────────────────────────────────────────┐
│                     FLOW LIFECYCLE                        │
│                                                          │
│  ┌─────────┐    ┌──────────┐    ┌───────────────────┐   │
│  │ CREATE  │───▶│  EDIT    │───▶│    PUBLISH         │   │
│  │ (Draft) │    │ (Draft)  │    │ (Lock versions)    │   │
│  └─────────┘    └──────────┘    └─────────┬─────────┘   │
│                                           │              │
│                      ┌────────────────────▼──────┐       │
│                      │      ENABLE               │       │
│                      │  (Register triggers,      │       │
│                      │   start polling/webhooks) │       │
│                      └────────────┬──────────────┘       │
│                                   │                      │
│                      ┌────────────▼──────────────┐       │
│                      │      RUNNING              │       │
│                      │  (Triggers fire,          │       │
│                      │   flows execute)          │       │
│                      └───────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

**What this diagram means:**

1. **CREATE (Draft)**: You click "New Flow." An empty flow is created with a DRAFT version. Think of it like creating a new Google Doc - it exists but is empty.

2. **EDIT (Draft)**: You drag and drop pieces, configure them, wire them together. All edits go to the draft version. You can edit as many times as you want without affecting anything live.

3. **PUBLISH (Lock versions)**: You click "Publish." This freezes the current draft - piece versions get locked to exact numbers (so updates to pieces don't break your flow), and the version is marked as LOCKED (immutable). The flow now has a `publishedVersionId` pointing to this frozen snapshot.

4. **ENABLE**: After publishing, you toggle the flow ON. This registers the trigger with the outside world. For example, if your trigger is "New GitHub Issue," this step calls GitHub's API and says "hey, send webhooks to this URL."

5. **RUNNING**: The flow is live. When the trigger fires (a new GitHub issue is created), a flow run begins.

### Flow Data Model

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────┐
│    Flow     │       │  FlowVersion     │       │   FlowRun    │
├─────────────┤  1:N  ├──────────────────┤  1:N  ├──────────────┤
│ id          │◄─────▶│ id               │◄─────▶│ id           │
│ projectId   │       │ flowId           │       │ flowVersionId│
│ status      │       │ displayName      │       │ status       │
│ publishedId─┼──────▶│ trigger (JSON)   │       │ startTime    │
│ folderId    │       │ state (DRAFT/    │       │ finishTime   │
│             │       │        LOCKED)   │       │ duration     │
│             │       │ valid            │       │ logsFileId   │
│             │       │ connectionIds    │       │ pauseMetadata│
│             │       │ updatedBy        │       │ failedStep   │
└─────────────┘       └──────────────────┘       └──────────────┘
```

**What this diagram means:**

Think of it like Google Docs with version history:

- **Flow** = The document itself. It has an ID, belongs to a project, and can be ENABLED or DISABLED. The `publishedId` arrow points to which version is currently "live."

- **FlowVersion** = A snapshot of the document. Every time you publish, a new version is created. The `trigger` field is a big JSON blob that contains the ENTIRE step tree: the trigger, then its nextAction, then that action's nextAction, and so on. It's like a linked list stored as nested JSON. The `state` is either DRAFT (you can still edit it) or LOCKED (frozen, immutable, used in production).

- **FlowRun** = One execution of the flow. Every time the trigger fires, a new run is created. It tracks the status (QUEUED → RUNNING → SUCCEEDED/FAILED/PAUSED/TIMEOUT), how long it took, and where to find the execution logs.

The `1:N` arrows mean "one-to-many": one Flow has many FlowVersions, and one FlowVersion can have many FlowRuns.

### Key Files

- Flow entity: `packages/server/api/src/app/flows/flow/flow.entity.ts`
- Flow version entity: `packages/server/api/src/app/flows/flow-version/flow-version-entity.ts`
- Flow run entity: `packages/server/api/src/app/flows/flow-run/flow-run-entity.ts`
- Flow service: `packages/server/api/src/app/flows/flow/flow.service.ts`
- Flow version service: `packages/server/api/src/app/flows/flow-version/flow-version.service.ts`
- Flow run service: `packages/server/api/src/app/flows/flow-run/flow-run-service.ts`

---

## 6. Pieces (Integrations)

### What is a Piece?

A "piece" is a plugin/connector for a specific service. The Gmail piece knows how to talk to Gmail. The Slack piece knows how to talk to Slack. Each piece provides:

```
┌──────────────────────────────────────────────────────────┐
│                      PIECE                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Metadata: name, description, logo, categories    │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Auth: OAuth2, API Key, Basic Auth, Custom, etc.  │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Triggers (events that START a flow):              │    │
│  │  - "New Email Received"                           │    │
│  │  - "New Spreadsheet Row"                          │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Actions (things a flow can DO):                   │    │
│  │  - "Send Message"                                 │    │
│  │  - "Create Spreadsheet Row"                       │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

**What this diagram means:**

Each piece is a box with four sections:
- **Metadata**: The name, icon, and description you see in the UI when browsing pieces.
- **Auth**: How to connect to the service. Gmail uses OAuth2 (the "Sign in with Google" popup), while some APIs just need an API key.
- **Triggers**: Events that can start a flow. These are the "When..." part of your automation.
- **Actions**: Operations the flow can perform. These are the "Do..." part.

There are **~465 community pieces** including: Slack, Gmail, Google Sheets, OpenAI, Discord, GitHub, HTTP, Webhook, RSS, Twitter, Notion, Airtable, and hundreds more.

Each piece is an npm package (e.g., `@activepieces/piece-slack`). Flow steps reference a piece by its name, version, and which action/trigger to use.

### Key Files

- Piece framework: `packages/pieces/community/framework/src/lib/piece.ts`
- Piece loader (engine): `packages/engine/src/lib/helper/piece-loader.ts`
- All pieces: `packages/pieces/community/` (each subdirectory is a piece)

---

## 7. Flow Execution Pipeline

This is what happens when a trigger fires and a flow needs to run:

```
 ┌───────────┐
 │  TRIGGER  │ (Webhook / Poll / Schedule / Manual)
 └─────┬─────┘
       │ payload (the data from the trigger, e.g., the new email)
       ▼
 ┌─────────────────┐
 │  API Server      │  flowRunService.start()
 │  Creates FlowRun │  status = QUEUED
 └─────┬───────────┘
       │ job (a message saying "run this flow with this data")
       ▼
 ┌─────────────────┐
 │  Redis Queue     │  BullMQ job queued
 │  (BullMQ)        │
 └─────┬───────────┘
       │ dequeue (worker picks up the next job)
       ▼
 ┌─────────────────┐
 │  Worker          │  jobQueueWorker picks up job
 │                  │  flowJobExecutor.executeFlow()
 └─────┬───────────┘
       │ sends execution request via socket.io
       ▼
 ┌─────────────────────────────────────────────────┐
 │  ENGINE (Sandboxed Process)                      │
 │                                                  │
 │  flowExecutor.execute()                          │
 │    │                                             │
 │    ├──▶ Step 1: Trigger data                     │
 │    │     └─ Extract the payload                  │
 │    │                                             │
 │    ├──▶ Step 2: Action (PIECE type)              │
 │    │     └─ pieceExecutor.handle()               │
 │    │       └─ Load the npm piece package         │
 │    │         └─ Resolve variables in settings    │
 │    │           └─ Call action.run(context)        │
 │    │                                             │
 │    ├──▶ Step 3: Router (ROUTER type)             │
 │    │     └─ Evaluate if/else conditions          │
 │    │       └─ Execute the matching branch        │
 │    │                                             │
 │    ├──▶ Step 4: Loop (LOOP type)                 │
 │    │     └─ For each item in array               │
 │    │       └─ Execute child steps                │
 │    │                                             │
 │    └──▶ Step N: ...                              │
 │                                                  │
 │  progressService.sendUpdate() ──▶ Worker ──▶ DB  │
 └──────────────────────────────────────────────────┘
```

**What this diagram means, step by step:**

1. **TRIGGER fires**: Something happens in the outside world (a new email, a webhook call, a scheduled time). The trigger produces a "payload" - the actual data (e.g., the email subject, body, sender).

2. **API Server creates a FlowRun**: A new row is inserted into the `flow_run` table with status `QUEUED`. Think of it like taking a number at a deli counter.

3. **Job goes into Redis Queue**: The "run this flow" message goes into a BullMQ queue in Redis. BullMQ is a library that uses Redis as a reliable job queue - jobs won't get lost even if the server crashes.

4. **Worker picks up the job**: The worker process is constantly watching the Redis queue. When a job appears, it picks it up and starts processing. This is a separate process from the API server so that long-running flows don't block HTTP requests.

5. **Engine executes in a sandbox**: The worker sends the flow definition to the Engine process via Socket.IO. The engine is a SEPARATE Node.js process that runs in isolation. Why? Because flows can contain user-written JavaScript code, and you don't want a buggy user script to crash your entire server.

6. **Step-by-step execution**: The engine walks through the step chain:
   - **PIECE action**: Load the npm package (e.g., `@activepieces/piece-slack`), fill in the settings with actual values (resolving `{{trigger.email}}` to the actual email), call the action's `run()` function.
   - **CODE action**: Run the user's custom JavaScript.
   - **ROUTER**: Evaluate conditions (if amount > 100, go left branch; otherwise go right branch).
   - **LOOP**: Iterate over an array and run child steps for each item.

7. **Progress updates**: Every ~5 seconds, the engine sends a progress update back to the worker, which saves it to the database. This is how you can see step-by-step progress in the UI.

### Engine Step Types

| Type | What it does |
|------|-------------|
| `PIECE` | Loads an npm piece package, resolves settings/variables, calls the action's `run()` function |
| `CODE` | Runs user-written JavaScript/TypeScript code |
| `ROUTER` | Evaluates if/else conditions and picks which branch to execute |
| `LOOP_ON_ITEMS` | Loops over an array and executes child steps for each item |

### Key Files

- Engine entry point: `packages/engine/src/main.ts`
- Core executor loop: `packages/engine/src/lib/handler/flow-executor.ts`
- Piece action executor: `packages/engine/src/lib/handler/piece-executor.ts`
- Execution context: `packages/engine/src/lib/handler/context/flow-execution-context.ts`
- Progress service: `packages/engine/src/lib/services/progress.service.ts`

---

## 8. Trigger System

Triggers are what START a flow. There are three types:

```
┌──────────────────────────────────────────────────────────────────┐
│                        TRIGGER TYPES                              │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │   WEBHOOK        │  │   POLLING         │  │   SCHEDULE     │  │
│  │                  │  │                   │  │                │  │
│  │ External service │  │ Cron job checks   │  │ Cron-based     │  │
│  │ POSTs to AP URL  │  │ for new data      │  │ time triggers  │  │
│  │                  │  │ periodically      │  │                │  │
│  │ e.g. GitHub      │  │                   │  │ e.g. every     │  │
│  │ webhook, Stripe  │  │ e.g. "New row     │  │ 5 minutes,     │  │
│  │ event            │  │ in Google Sheet"  │  │ daily at 9am   │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬────────┘  │
│           │                     │                     │           │
│           ▼                     ▼                     ▼           │
│   onEnable() registers   Creates repeating    Creates repeating  │
│   webhook URL with       BullMQ job with      BullMQ job with    │
│   external service       cron expression      cron expression    │
└──────────────────────────────────────────────────────────────────┘
```

**What each type means:**

**WEBHOOK triggers**: The external service pushes data TO you.
- Example: You tell GitHub "send a POST request to `https://myapp.com/webhooks/flow_123` whenever a new issue is created."
- When you enable the flow, `onEnable()` calls GitHub's API to register that URL.
- When a new issue is created, GitHub sends an HTTP POST to your server with the issue data.
- Your server receives it, creates a FlowRun, and queues it for execution.

**POLLING triggers**: You periodically CHECK the external service for new data.
- Example: "New Row in Google Sheets" - there's no way for Google Sheets to push data to you automatically.
- When you enable the flow, a repeating BullMQ job is created (e.g., "check every 5 minutes").
- Every 5 minutes, the worker runs the trigger's `run()` function, which calls Google Sheets API to check for new rows.
- If new rows are found, a FlowRun is created for each one.

**SCHEDULE triggers**: Like polling but time-based, not data-based.
- Example: "Every day at 9am" or "Every 5 minutes."
- Works the same as polling (repeating BullMQ job with a cron expression).
- The trigger fires at the scheduled time regardless of external data.

### Key Files

- Trigger execution (engine): `packages/engine/src/lib/helper/trigger-helper.ts`
- Trigger side effects (server): `packages/server/api/src/app/trigger/trigger-source/flow-trigger-side-effect.ts`
- Schedule triggers: `packages/pieces/community/schedule/src/lib/triggers/`

---

## 9. All Backend Services

The API server is organized into **26 modules**. Each module handles a specific area. Here's every single one:

### Core Application Services

| Module | What It Does | Key Endpoints |
|--------|-------------|---------------|
| **Flows** | Create, edit, delete, list flows. Apply operations (add/update/delete steps). Publish flow versions. | `POST /v1/flows`, `GET /v1/flows`, `GET /v1/flows/:id` |
| **Flow Runs** | Start, stop, retry flow executions. View run history and logs. | `GET /v1/flow-runs`, `POST /v1/flow-runs/:id/retry` |
| **Flow Versions** | Manage draft/locked versions of flows. | `GET /v1/flow-versions/:id` |
| **Flow Comments** | Add comments to flows for collaboration. | `POST /v1/flow-comments`, `GET /v1/flow-comments` |
| **Flow Activity** | Track changes made to flows (audit trail). | `GET /v1/flow-activities` |
| **Triggers** | Manage trigger registration, polling, and events. | `GET /v1/trigger-runs/status` |
| **Webhooks** | Receive incoming webhook calls from external services. | `ALL /v1/webhooks/:flowId` |
| **App Connections** | Store OAuth2 tokens and API keys for external services (encrypted). | `POST /v1/app-connections`, `GET /v1/app-connections` |
| **Pieces** | List available integration pieces and sync their metadata. | `GET /v1/pieces` |
| **Store Entries** | Key-value store that flows can use to persist data between runs. | `POST /v1/store-entries`, `GET /v1/store-entries` |
| **Step Files** | Upload and download files created by flow steps. | `POST /v1/step-files`, `GET /v1/step-files/signed` |

### User & Access Management

| Module | What It Does | Key Endpoints |
|--------|-------------|---------------|
| **Authentication** | Sign up, sign in, switch projects. JWT token generation. | `POST /v1/authentication/sign-in`, `POST /v1/authentication/sign-up` |
| **Users** | Get current user profile and manage platform users. | `GET /v1/users/me` |
| **User Invitations** | Send and manage user invitations. | - |
| **Projects** | Create and manage projects (workspaces). | `POST /v1/projects`, `GET /v1/projects` |
| **Project Members** | Add/remove users from projects, assign roles. | `POST /v1/project-members`, `GET /v1/project-members` |
| **Project Roles** | List available project roles (CE). | `GET /v1/project-roles` |
| **Platform** | Configure platform settings (branding, auth, features). | `POST /v1/platforms/:id`, `GET /v1/platforms/:id` |

### Tables & Data

| Module | What It Does | Key Endpoints |
|--------|-------------|---------------|
| **Tables** | Create and manage database tables within projects. | `POST /v1/tables`, `GET /v1/tables` |
| **Fields** | Define columns (fields) on tables. | `POST /v1/fields`, `GET /v1/fields` |
| **Records** | CRUD operations on table rows. | `POST /v1/records`, `GET /v1/records` |
| **Todos** | Task management (create, assign, resolve todos). | `POST /v1/todos`, `GET /v1/todos` |

### AI & Intelligence

| Module | What It Does | Key Endpoints |
|--------|-------------|---------------|
| **OpSyn** | Generate flows from natural language using AI model. | `POST /v1/opsyn/generate`, `GET /v1/opsyn/model-status` |
| **AI Providers** | Manage AI provider API keys (OpenAI, Anthropic, etc.). | `POST /v1/ai-providers`, `GET /v1/ai-providers` |
| **MCP** | Model Context Protocol - expose tools for AI assistants. | `GET /v1/mcp-servers`, `POST /v1/mcp-servers` |

### Infrastructure

| Module | What It Does | Key Endpoints |
|--------|-------------|---------------|
| **Workers** | Manage background workers and engine instances. | - |
| **Health** | Health check endpoints. | `GET /v1/health` |
| **Flags** | Feature flags management. | `GET /v1/flags` |
| **Core** | Security handlers, rate limiting, WebSocket setup. | - |
| **Database** | Database connections, entity schemas, 416+ migrations. | - |

### Enterprise Edition (EE) Only

| Module | What It Does |
|--------|-------------|
| **SAML SSO** | SAML-based single sign-on |
| **Google OAuth** | Google-based federated auth |
| **API Keys** | Platform API key management |
| **Audit Logs** | Track all platform actions |
| **Custom Domains** | Use your own domain |
| **Project Releases** | Version-controlled flow deployments |
| **Git Sync** | Sync flows with a Git repository |
| **Custom Roles** | Granular permission management |
| **Analytics** | Platform usage analytics |
| **Billing (Stripe)** | Subscription management |
| **OAuth Apps** | Manage OAuth applications |
| **Solutions** | Solution packaging |
| **License Keys** | License management |
| **Signing Keys** | Cryptographic signing |
| **Alerts** | Alert management |

---

## 10. API Server & Request Pipeline

Every HTTP request goes through a security pipeline before reaching the route handler:

```
┌────────────────────────────────────────────────────────────────┐
│                  REQUEST PIPELINE                               │
│                                                                 │
│  Incoming HTTP Request                                          │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AUTHENTICATION CHAIN (who are you?)                     │   │
│  │                                                          │   │
│  │  1. PlatformApiKeyAuthnHandler                           │   │
│  │     └─ Check "api-key" header → API Key auth             │   │
│  │                                                          │   │
│  │  2. AccessTokenAuthnHandler                              │   │
│  │     └─ Check "Authorization: Bearer <JWT>" header        │   │
│  │     └─ Verify JWT → check session validity               │   │
│  │                                                          │   │
│  │  3. AnonymousAuthnHandler                                │   │
│  │     └─ Allow unauthenticated (for public routes)         │   │
│  └──────────────────────────────────────────────────────────┘   │
│       │ request.principal = { id, type, projectId, platform }   │
│       ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AUTHORIZATION CHAIN (can you do this?)                  │   │
│  │                                                          │   │
│  │  1. PrincipalTypeAuthzHandler                            │   │
│  │     └─ Check principal type matches route config         │   │
│  │        (USER, WORKER, ENGINE, SERVICE)                   │   │
│  │                                                          │   │
│  │  2. ProjectAuthzHandler                                  │   │
│  │     └─ Verify user has access to the project             │   │
│  │                                                          │   │
│  │  3. RBAC Middleware (Enterprise)                         │   │
│  │     └─ Check granular permission (READ_FLOW, etc.)       │   │
│  └──────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  Route Handler (controller → service → database)                │
└────────────────────────────────────────────────────────────────┘
```

**What this diagram means:**

When your browser sends a request like `GET /v1/flows`, it goes through two gates:

**Gate 1 - Authentication (Who are you?)**

The server tries three methods in order:
1. **API Key**: Is there an `api-key` header? If yes, look up the API key in the database to find which platform it belongs to. This is for external integrations.
2. **JWT Token**: Is there an `Authorization: Bearer eyJ...` header? If yes, decode the JWT to find the userId, projectId, and platformId. This is what the web app uses.
3. **Anonymous**: If neither of the above, the request is anonymous. This is only allowed for public routes like the sign-in page.

The result is a `principal` object attached to the request: `{ id: "user_123", type: "USER", projectId: "proj_456", platform: { id: "plat_789" } }`.

**Gate 2 - Authorization (Can you do this?)**

Now the server checks if this principal is ALLOWED to do what they're asking:
1. **Principal Type**: Is the route configured to allow USER principals? Some routes only allow WORKER or ENGINE principals (internal system calls).
2. **Project Access**: Does this user belong to the project they're trying to access?
3. **RBAC (Enterprise)**: Does the user's role have the required permission? E.g., a VIEWER can `READ_FLOW` but not `WRITE_FLOW`.

If all checks pass, the request reaches the actual route handler.

### Key Files

- Security handler chain: `packages/server/api/src/app/core/security/security-handler-chain.ts`
- JWT token manager: `packages/server/api/src/app/authentication/lib/access-token-manager.ts`

---

## 11. Authentication & Users

### How Login Works

```
┌─────────┐                    ┌────────────┐              ┌──────────┐
│ Browser  │                    │ API Server │              │PostgreSQL│
└────┬────┘                    └─────┬──────┘              └────┬─────┘
     │                               │                          │
     │  POST /v1/authentication/     │                          │
     │  sign-in {email, password}    │                          │
     │──────────────────────────────▶│                          │
     │                               │  Find user identity      │
     │                               │─────────────────────────▶│
     │                               │◀─────────────────────────│
     │                               │  Verify password (bcrypt)│
     │                               │  Generate JWT (7d expiry)│
     │                               │  JWT contains:           │
     │                               │   - userId               │
     │                               │   - projectId            │
     │                               │   - platformId           │
     │    { token: "eyJ..." }        │   - type: "USER"         │
     │◀──────────────────────────────│                          │
     │                               │                          │
     │  GET /v1/flows                │                          │
     │  Authorization: Bearer eyJ... │                          │
     │──────────────────────────────▶│                          │
     │                               │  Verify JWT signature    │
     │                               │  Check tokenVersion      │
     │                               │  Check user.status=ACTIVE│
     │    { flows: [...] }           │                          │
     │◀──────────────────────────────│                          │
```

**What this diagram means:**

This shows the conversation between your browser (left), the server (middle), and the database (right). Time flows downward.

1. Your browser sends your email and password to the sign-in endpoint.
2. The server looks up your email in the database to find your `UserIdentity` record (which has your hashed password).
3. The server checks if your password matches the hash using bcrypt.
4. If it matches, the server creates a JWT (JSON Web Token) - a long encoded string like `eyJhbGciOiJIUzI1NiJ9...`. This token contains your userId, projectId, and platformId. It expires in 7 days.
5. Your browser stores this token and sends it with every future request in the `Authorization: Bearer eyJ...` header.
6. For every subsequent request, the server decodes the JWT, checks it hasn't been tampered with, checks the `tokenVersion` (to support "log out everywhere"), and checks the user is still ACTIVE.

### User Data Model

```
┌───────────────────┐        ┌────────────────────────┐
│   UserIdentity    │        │        User            │
├───────────────────┤   1:N  ├────────────────────────┤
│ id                │◄──────▶│ id                     │
│ email             │        │ identityId             │
│ password (hash)   │        │ platformId             │
│ firstName         │        │ platformRole           │
│ lastName          │        │   (ADMIN/MEMBER/       │
│ verified          │        │    OPERATOR)           │
│ provider          │        │ status (ACTIVE/        │
│  (EMAIL/GOOGLE/   │        │         INACTIVE)      │
│   SAML/JWT)       │        │ externalId             │
│ tokenVersion      │        └────────────────────────┘
└───────────────────┘
```

**What this diagram means:**

There are two separate tables because one person (identity) can exist as a User on multiple platforms:

- **UserIdentity**: Your login credentials. Contains your email, password hash, and which login method you used (regular email, Google OAuth, SAML SSO). The `tokenVersion` is a counter - when you change your password or an admin revokes your sessions, this number increments, which invalidates ALL existing JWT tokens.

- **User**: Your membership on a specific platform. Contains your role (ADMIN, MEMBER, or OPERATOR) and status (ACTIVE or INACTIVE). One UserIdentity can have multiple User records (one per platform), hence the `1:N` relationship.

### Supported Auth Methods

- **Email/Password**: You type email and password. Standard.
- **Google OAuth**: "Sign in with Google" button. Redirects to Google, comes back with a token.
- **SAML SSO** (Enterprise): Corporate single sign-on (like "Sign in with your company account").
- **JWT-based SSO** (Enterprise): Custom SSO using JWT tokens.

---

## 12. Projects, Platforms & Permissions

### Multi-Tenancy: Platform → Project → User

```
┌─────────────────────────────────────────────────────────────┐
│                        PLATFORM                              │
│  (Branding, auth config, feature flags, SSO settings)        │
│                                                              │
│  ┌───────────────────┐    ┌───────────────────┐             │
│  │    PROJECT A       │    │    PROJECT B       │             │
│  │  ┌─────────────┐  │    │  ┌─────────────┐  │             │
│  │  │ Flows       │  │    │  │ Flows       │  │             │
│  │  │ Connections │  │    │  │ Connections │  │             │
│  │  │ Runs        │  │    │  │ Runs        │  │             │
│  │  │ Tables      │  │    │  │ Tables      │  │             │
│  │  │ Todos       │  │    │  │ Todos       │  │             │
│  │  └─────────────┘  │    │  └─────────────┘  │             │
│  │                    │    │                    │             │
│  │  Members:          │    │  Members:          │             │
│  │   Alice (OWNER)    │    │   Bob (OWNER)      │             │
│  │   Bob (EDITOR)     │    │   Carol (VIEWER)   │             │
│  └───────────────────┘    └───────────────────┘             │
│                                                              │
│  Platform Users:                                             │
│   Alice (ADMIN) - sees all projects                          │
│   Bob (MEMBER) - sees only invited projects                  │
│   Carol (OPERATOR) - sees all projects, no admin panel       │
└─────────────────────────────────────────────────────────────┘
```

**What this diagram means:**

Think of it like a company structure:

- **Platform** = Your entire Activepieces installation. There's usually just one. It holds global settings like branding (logo, colors), which login methods are allowed, and which features are enabled.

- **Projects** = Like workspaces or departments. Each project is isolated - Project A's flows can't see Project B's data. A project contains all its own flows, connections (API keys/OAuth tokens), runs, tables, and todos.

- **Users exist at TWO levels**:
  - **Platform level**: Alice is a platform ADMIN (she can see everything and manage settings). Bob is a MEMBER (he can only see projects he's invited to). Carol is an OPERATOR (she can see all projects but can't access admin settings).
  - **Project level**: Within Project A, Alice is the OWNER (full control) and Bob is an EDITOR (can edit but can't manage members). Within Project B, Bob is the OWNER and Carol is a VIEWER (read-only).

### Role Permissions Table

**Platform Roles:**

| Platform Role | See all projects? | Admin settings? |
|--------------|------------------|----------------|
| ADMIN | Yes | Yes |
| MEMBER | Only invited ones | No |
| OPERATOR | Yes | No |

**Project Roles (Community Edition):**

| Project Role | View flows | Edit flows | Manage members |
|-------------|-----------|-----------|---------------|
| OWNER | Yes | Yes | Yes |
| EDITOR | Yes | Yes | No |
| VIEWER | Yes | No | No |

**Enterprise Edition** adds custom roles with granular permissions like `READ_FLOW`, `WRITE_FLOW`, `UPDATE_FLOW_STATUS`, `READ_RUN`, `WRITE_RUN`, etc.

---

## 13. Real-Time Collaboration & Socket.IO

### What is Socket.IO? (It's NOT a separate server)

**Socket.IO is a JavaScript library** (not a server). It adds real-time bidirectional communication on top of your existing Fastify server. Here's the difference:

- **Normal HTTP**: Browser sends request → Server sends response → Connection closes. Like sending a letter and waiting for a reply.
- **WebSocket**: Browser and server keep a permanent connection open. Either side can send messages at any time. Like a phone call.
- **Socket.IO**: A library that wraps WebSocket and adds useful features: "rooms" (groups of connections), automatic reconnection, and fallback to HTTP polling if WebSocket isn't available.

Socket.IO runs INSIDE your Fastify server (on the same port 3000). It's not a separate process. When the React app loads, it opens both a regular HTTP connection AND a WebSocket connection to the same server.

### How Real-Time Collaboration Works

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Alice's  │    │  Bob's   │    │ Carol's  │
│ Browser  │    │ Browser  │    │ Browser  │
└────┬─────┘    └────┬─────┘    └────┬─────┘
     │ WS            │ WS            │ WS
     │               │               │
     ▼               ▼               ▼
┌─────────────────────────────────────────────────┐
│            SOCKET.IO (inside Fastify)            │
│                                                  │
│  Rooms:                                          │
│  ┌─────────────────────────────────────────┐    │
│  │ project:proj_123                        │    │
│  │   - Alice, Bob, Carol (auto-joined)     │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │ flow:flow_abc                           │    │
│  │   - Alice, Bob (manually joined)        │    │
│  │   activeEditors: [Alice, Bob]           │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  Redis Adapter ◄──────────────▶ Redis PubSub     │
│  (for multiple server instances)                 │
└─────────────────────────────────────────────────┘
```

**What this diagram means:**

When Alice, Bob, and Carol log in, their browsers each open a WebSocket connection (the "WS" arrows). Inside Socket.IO, connections are organized into **rooms** (like chat rooms):

- **`project:proj_123`**: Everyone in the same project is automatically added here. This is used for project-wide notifications (e.g., "a flow run just finished" or "project members changed").

- **`flow:flow_abc`**: When Alice opens a specific flow in the builder, she joins this room. When Bob opens the same flow, he joins too. Now anything that happens in this flow room is broadcast to both of them.

The **Redis Adapter** at the bottom is for scaling. If you run multiple copies of the API server (for high availability), they all connect to the same Redis instance. When Alice's server broadcasts a message, Redis forwards it to Bob's server too. This way rooms work across multiple server instances.

### The Collaboration Sequence

```
Alice edits a step (e.g., changes the Slack channel)
       │
       ▼
Alice's browser sends HTTP POST /v1/flows/flow_abc
  with operation: { type: UPDATE_ACTION, settings: { channel: "#general" } }
       │
       ▼
Server applies the operation to the DRAFT FlowVersion in PostgreSQL
       │
       ▼
Server broadcasts via Socket.IO:
  event: FLOW_OPERATION_BROADCAST
  to room: "flow:flow_abc"
  EXCLUDING Alice's socket (she already knows about her own change)
       │
       ▼
Bob's browser receives the FLOW_OPERATION_BROADCAST event
       │
       ▼
Bob's React Flow canvas re-renders with the updated step
(Bob sees the Slack channel change to "#general" in real-time)
```

**What this means in plain English:**

Alice and Bob are both editing the same flow. Alice changes the Slack channel. Her browser sends the change to the server via a normal HTTP request. The server saves it to the database AND broadcasts it to everyone else in the `flow:flow_abc` room. Bob's browser receives the broadcast and updates his view. Bob sees Alice's change appear without refreshing.

### What happens with conflicts?

If Alice and Bob edit the SAME step at the SAME time, the system uses **version-based conflict resolution**. Each operation includes the `flowVersionId`. If the server detects a mismatch (Bob's operation was based on an older version), it rejects it and Bob's browser refreshes with the latest version. Bob sees a toast notification saying "This flow was updated by another user."

### Active Editor Tracking

The server tracks who's currently editing each flow:
- When you open a flow → server adds you to the `activeEditors` map → broadcasts `FLOW_EDITORS_CHANGED` → everyone sees your avatar
- When you close the flow → server removes you → broadcasts update → your avatar disappears
- When your browser disconnects → server cleans up all your memberships

### Key Files

- WebSocket service: `packages/server/api/src/app/core/websockets.service.ts`
- Flow WebSocket handlers: `packages/server/api/src/app/flows/flow/flow-websocket-handlers.ts`
- WebSocket events: `packages/shared/src/lib/websocket/index.ts`

---

## 14. Tables (Built-in Database)

### What are Tables?

Tables are a built-in spreadsheet-like database inside Activepieces. Think of it like a simplified version of Airtable or a Google Sheet, but stored directly in your Activepieces database.

You can:
- Create tables with typed columns
- Add, edit, delete rows
- Use tables in flows (read/write data)
- Set up webhooks so flows trigger when data changes

### Table Data Model

```
┌──────────────┐
│    Table     │
├──────────────┤
│ id           │
│ name         │
│ projectId    │     ┌──────────────┐
│ trigger      │     │    Field     │  (= Column)
│ status       │     ├──────────────┤
│              │ 1:N │ id           │
│              │◄───▶│ name         │
│              │     │ type         │  TEXT, NUMBER, DATE, STATIC_DROPDOWN
│              │     │ tableId      │
│              │     │ data         │  (dropdown options, if applicable)
│              │     └──────────────┘
│              │
│              │     ┌──────────────┐     ┌──────────────┐
│              │ 1:N │   Record     │ 1:N │    Cell      │
│              │◄───▶│ (= Row)      │◄───▶│ (= Value)    │
│              │     ├──────────────┤     ├──────────────┤
│              │     │ id           │     │ id           │
│              │     │ tableId      │     │ recordId     │
│              │     │ projectId    │     │ fieldId      │
│              │     └──────────────┘     │ value        │
│              │                          └──────────────┘
│              │
│              │     ┌──────────────────┐
│              │ 1:N │  TableWebhook    │
│              │◄───▶├──────────────────┤
│              │     │ id               │
│              │     │ tableId          │
│              │     │ flowId           │
│              │     │ events           │  RECORD_CREATED, RECORD_UPDATED,
│              │     │                  │  RECORD_DELETED
└──────────────┘     └──────────────────┘
```

**What this diagram means (thinking of it like a spreadsheet):**

- **Table** = An entire spreadsheet. Has a name (like "Customers" or "Orders").
- **Field** = A column header (like "Name", "Email", "Age"). Each field has a type:
  - `TEXT`: Free text (like "John Smith")
  - `NUMBER`: Numbers (like 42, 3.14)
  - `DATE`: Dates/times
  - `STATIC_DROPDOWN`: A dropdown with predefined options (like "Active" / "Inactive")
- **Record** = A row in the spreadsheet.
- **Cell** = A single value in one row and one column. The cell links a record (row) to a field (column) and stores the value.
- **TableWebhook** = A hook that says "when a record is created/updated/deleted in this table, trigger this flow."

### How Table Webhooks Work

```
User adds a new record to "Customers" table
       │
       ▼
Server saves the record to PostgreSQL
       │
       ▼
Server checks: are there any webhooks for this table
with event type RECORD_CREATED?
       │
       ▼
Yes! Webhook points to flow_xyz
       │
       ▼
Server calls webhookService.handleWebhook(flow_xyz, recordData)
       │
       ▼
A new FlowRun is created for flow_xyz
with the record data as the trigger payload
```

This means you can build automations like: "When a new customer is added to my Customers table, send them a welcome email."

### Tables Piece (for use in flows)

There's a piece called `@activepieces/piece-tables` that lets flows interact with tables:
- **Create Records**: Add new rows
- **Update Record**: Modify an existing row
- **Find Records**: Search with filters (equals, contains, greater than, etc.)
- **Get Record**: Fetch a specific row by ID

### Key Files

- Table entity: `packages/server/api/src/app/tables/table/table.entity.ts`
- Field entity: `packages/server/api/src/app/tables/field/field.entity.ts`
- Record entity: `packages/server/api/src/app/tables/record/record.entity.ts`
- Cell entity: `packages/server/api/src/app/tables/record/cell.entity.ts`
- Webhook entity: `packages/server/api/src/app/tables/table/table-webhook.entity.ts`
- Table service: `packages/server/api/src/app/tables/table/table.service.ts`
- Record service: `packages/server/api/src/app/tables/record/record.service.ts`

---

## 15. AI / OpSyn Model Server (FastAPI + Python)

### What is FastAPI?

FastAPI is a Python web framework for building APIs. It's like Fastify but for Python. It's very popular for serving AI/ML models because:
1. Python is where all the AI/ML libraries are (PyTorch, Transformers, etc.)
2. FastAPI is fast and async
3. It auto-generates API documentation

The OpSyn model server is a completely SEPARATE application from the main Activepieces server. It runs on a different machine (a GPU server), written in Python, and the TypeScript backend calls it over HTTP.

### The Complete AI Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                    AI WORKFLOW GENERATION PIPELINE                      │
│                                                                        │
│  User types: "When a new GitHub issue is created, post it to Slack"    │
│       │                                                                │
│       ▼                                                                │
│  ┌──────────────────────────────────────────┐                          │
│  │  STEP 1: React UI                        │                          │
│  │                                          │                          │
│  │  User clicks "Generate with AI" button   │                          │
│  │  Types their prompt in a dialog box      │                          │
│  │  Clicks "Generate"                       │                          │
│  │                                          │                          │
│  │  Frontend calls opsynApi.generate()      │                          │
│  │  which sends POST /v1/opsyn/generate     │                          │
│  └───────────────┬──────────────────────────┘                          │
│                  │                                                      │
│                  ▼                                                      │
│  ┌──────────────────────────────────────────┐                          │
│  │  STEP 2: TypeScript Backend (Fastify)    │                          │
│  │                                          │                          │
│  │  opsyn.controller.ts receives request    │                          │
│  │  opsyn.service.ts calls                  │                          │
│  │  modelInferenceService.generateWorkflow()│                          │
│  │                                          │                          │
│  │  This sends an HTTP POST to the Python   │                          │
│  │  server at /generate-workflow with the   │                          │
│  │  user's prompt. Timeout: 180 seconds.    │                          │
│  └───────────────┬──────────────────────────┘                          │
│                  │                                                      │
│                  ▼                                                      │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  STEP 3: Python Model Server (FastAPI on Modal GPU)          │      │
│  │                                                              │      │
│  │  3a. FORMAT THE PROMPT                                       │      │
│  │      System prompt: "You are an AI Workflow Builder for      │      │
│  │      OPSYN. Return ONLY valid JSON with keys: displayName,   │      │
│  │      trigger, schemaVersion."                                │      │
│  │      User prompt: the user's natural language input          │      │
│  │      Format into chat template for the model                 │      │
│  │                                                              │      │
│  │  3b. MODEL INFERENCE                                         │      │
│  │      Load Qwen2.5-Coder-7B-Instruct (base model)           │      │
│  │      Apply LoRA adapter (fine-tuned weights)                 │      │
│  │      4-bit quantization (saves GPU memory)                   │      │
│  │      Generate tokens (max 2048) with sampling                │      │
│  │      Decode tokens back to text                              │      │
│  │      Output: raw text that SHOULD be JSON but might          │      │
│  │      have errors, truncation, wrong names, etc.              │      │
│  │                                                              │      │
│  │  3c. JSON EXTRACTION                                         │      │
│  │      Strip markdown code fences (```json ... ```)            │      │
│  │      Balance braces and brackets                             │      │
│  │      Repair common JSON errors:                              │      │
│  │        - Trailing commas                                     │      │
│  │        - Single quotes → double quotes                       │      │
│  │        - Unquoted property names                             │      │
│  │        - JavaScript comments                                 │      │
│  │        - Missing commas                                      │      │
│  │      Handle truncated output (add missing closing braces)    │      │
│  │                                                              │      │
│  │  3d. POST-PROCESSING (the most complex part)                 │      │
│  │      1. Normalize piece names:                               │      │
│  │         "slack" → "@activepieces/piece-slack"                │      │
│  │         "google-sheets" → "@activepieces/piece-google-sheets"│      │
│  │      2. Fix action/trigger names:                            │      │
│  │         Static mappings (e.g., "sendMessage" → "send_message")│     │
│  │         Smart matching with fuzzy search (75%+ confidence)   │      │
│  │         Embedding model (cosine similarity) as fallback      │      │
│  │      3. Move misplaced actions to correct pieces:            │      │
│  │         "return_response" was put in HTTP piece?             │      │
│  │         Move it to webhook piece where it belongs.           │      │
│  │      4. Add correct piece versions from registry:            │      │
│  │         Look up piece_registry.json (467+ pieces)            │      │
│  │      5. Fix variable syntax:                                 │      │
│  │         "{{{step_1.output}}}" → "{{step_1.output}}"         │      │
│  │      6. Ensure required fields exist:                        │      │
│  │         Every step needs: name, displayName, valid, input    │      │
│  │      7. Handle special types:                                │      │
│  │         ROUTER: ensure children match branches               │      │
│  │         LOOP: ensure items field exists                      │      │
│  │         CODE: ensure sourceCode structure                    │      │
│  │                                                              │      │
│  │  3e. CREATE FLOW TEMPLATE                                    │      │
│  │      Wrap the processed workflow in FlowTemplate format      │      │
│  │      Include: name, description, tags, pieces list           │      │
│  └───────────────┬──────────────────────────────────────────────┘      │
│                  │                                                      │
│                  ▼                                                      │
│  ┌──────────────────────────────────────────┐                          │
│  │  STEP 4: Back to TypeScript Backend      │                          │
│  │                                          │                          │
│  │  Receives FlowTemplate JSON from Python  │                          │
│  │  Returns it to the frontend              │                          │
│  └───────────────┬──────────────────────────┘                          │
│                  │                                                      │
│                  ▼                                                      │
│  ┌──────────────────────────────────────────┐                          │
│  │  STEP 5: React UI                        │                          │
│  │                                          │                          │
│  │  Creates a new flow                      │                          │
│  │  Imports the FlowTemplate                │                          │
│  │  Opens the flow in the builder           │                          │
│  │  User can review and edit before         │                          │
│  │  publishing                              │                          │
│  └──────────────────────────────────────────┘                          │
└────────────────────────────────────────────────────────────────────────┘
```

### Understanding the AI Model

**What is Qwen2.5-Coder-7B?**
It's a 7-billion-parameter language model made by Alibaba, specifically designed for code generation. "7B" means it has 7 billion numbers (weights) that it uses to predict what comes next in text.

**What is LoRA?**
LoRA (Low-Rank Adaptation) is a technique to fine-tune a model cheaply. Instead of retraining all 7 billion weights, you train a small "adapter" (a few million extra weights) that modifies the model's behavior. The adapter teaches the base model how to generate Activepieces workflow JSON specifically.

**What is 4-bit quantization?**
The model normally stores each weight as a 16-bit or 32-bit number. 4-bit quantization compresses them to 4 bits each, using 4x less GPU memory. This lets the model run on a single A10G GPU (24GB) instead of needing multiple GPUs.

**What is Modal?**
Modal is a cloud platform for running GPU workloads. You define your Python environment and GPU requirements, and Modal spins up a GPU server on demand. It scales to zero when not in use (you only pay when the model is actually generating). The configuration uses:
- A10G GPU with 24GB memory
- 32GB system RAM
- 600-second timeout
- 20-second idle before scale-down

### How the Python Server Starts

```python
# server_v2.py simplified
app = FastAPI()

model = None
tokenizer = None

def load_model():
    # 1. Load tokenizer (how to convert text → numbers)
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    
    # 2. Load base model with 4-bit quantization
    model = AutoModelForCausalLM.from_pretrained(
        "Qwen/Qwen2.5-Coder-7B-Instruct",
        quantization_config=BitsAndBytesConfig(load_in_4bit=True)
    )
    
    # 3. Load LoRA adapter (fine-tuned weights)
    model = PeftModel.from_pretrained(model, adapter_path)
    
    # 4. Set to evaluation mode (no training)
    model.eval()

@app.post("/generate-workflow")
def generate_workflow(prompt: str):
    # Format prompt → generate tokens → extract JSON → post-process
    ...

# Start server
uvicorn.run(app, port=8000)
```

### Python Server Endpoints

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/health` | GET | Returns model status (loaded? what GPU?) |
| `/generate` | POST | Raw model output (no post-processing). For debugging. |
| `/generate-workflow` | POST | Full pipeline: generate + extract JSON + post-process. Main endpoint. |
| `/process` | POST | Post-process raw output only (no model inference). For when you generated elsewhere. |

### How TypeScript Calls Python

```typescript
// model-inference.service.ts simplified
const PYTHON_SERVER_URL = "https://...modal.run";

async function generateWorkflow(prompt: string) {
    const response = await axios.post(
        `${PYTHON_SERVER_URL}/generate-workflow`,
        { prompt, max_tokens: 2048, temperature: 0.3 },
        { timeout: 180000 }  // 3 minute timeout
    );
    return response.data.template;  // FlowTemplate JSON
}
```

### The Embedding Model

Separately from the main Qwen model, there's a smaller model in `activepieces_embedding_model/`:
- **Base**: `sentence-transformers/all-MiniLM-L6-v2` (much smaller, ~22M parameters)
- **Purpose**: Convert text into 384-dimensional vectors for similarity comparison
- **Used for**: When the AI generates an action name like "send_slack_message" but the real name is "send_channel_message", the embedding model computes how similar these two strings are (cosine similarity) and picks the closest valid name
- **Training data**: 3,981 Activepieces-specific examples

### Key Files

- Python server: `opsyn-model-server/server_v2.py`
- Post-processor: `opsyn-model-server/postprocessor_v2.py`
- Smart matcher: `opsyn-model-server/smart_matcher.py`
- Modal deployment: `opsyn-model-server/modal_app_v2.py`
- Piece registry: `opsyn-model-server/piece_registry.json`
- TypeScript model service: `packages/server/api/src/app/opsyn/model-inference.service.ts`
- TypeScript OpSyn service: `packages/server/api/src/app/opsyn/opsyn.service.ts`
- TypeScript controller: `packages/server/api/src/app/opsyn/opsyn.controller.ts`
- Frontend dialog: `packages/react-ui/src/features/opsyn/components/generate-workflow-dialog.tsx`

---

## 16. MCP (Model Context Protocol)

### What is MCP?

MCP (Model Context Protocol) is a standard created by Anthropic that lets AI assistants use external tools. Think of it like a USB port for AI - any AI assistant that speaks MCP can plug into any MCP server and use its tools.

In Activepieces, you can create an MCP server that exposes your pieces and flows as tools. Then Claude Desktop, Cursor, or any MCP-compatible AI can call those tools.

### How Users Create Their Own MCP Server

```
┌──────────────────────────────────────────────────────────────┐
│  USER CREATES AN MCP SERVER                                   │
│                                                               │
│  Step 1: Go to MCP settings in the UI                        │
│          Click "Create MCP Server"                            │
│          Give it a name (e.g., "My Tools")                    │
│                                                               │
│  Step 2: Add tools to the server                              │
│          Choose between:                                      │
│                                                               │
│          PIECE tools:                                         │
│          "I want Claude to be able to send Slack messages"    │
│          → Add the Slack piece's "Send Message" action        │
│                                                               │
│          FLOW tools:                                          │
│          "I want Claude to be able to trigger my flow"        │
│          → Add a published flow as a tool                     │
│                                                               │
│  Step 3: Get the MCP Server URL + Token                       │
│          URL: https://myapp.com/api/v1/mcp/{token}/sse       │
│          Copy this into Claude Desktop's config               │
│                                                               │
│  Step 4: Configure your MCP client                            │
│          In Claude Desktop settings, add:                     │
│          {                                                    │
│            "mcpServers": {                                    │
│              "my-tools": {                                    │
│                "url": "https://myapp.com/api/v1/mcp/{token}" │
│              }                                                │
│            }                                                  │
│          }                                                    │
│                                                               │
│  Step 5: Use it!                                              │
│          Tell Claude: "Send a Slack message to #general       │
│          saying hello"                                        │
│          Claude calls the MCP tool → Activepieces executes    │
│          the Slack action → message is sent                   │
└──────────────────────────────────────────────────────────────┘
```

### How MCP Works Internally

```
┌──────────────┐                    ┌──────────────────────────────────┐
│              │    SSE Connection   │  ACTIVEPIECES MCP SERVER         │
│  Claude      │◄──────────────────▶│                                  │
│  Desktop     │                    │  1. Client connects via SSE      │
│              │                    │     GET /v1/mcp/{token}/sse      │
│  "Send a     │                    │                                  │
│   Slack      │  tool_call:        │  2. Server authenticates via     │
│   message    │  send_message      │     token, loads MCP config      │
│   to         │ ──────────────────▶│                                  │
│   #general"  │                    │  3. Server receives tool call    │
│              │                    │                                  │
│              │                    │  For PIECE tools:                │
│              │                    │  4a. Uses GPT-4.1 to extract     │
│              │                    │      structured parameters       │
│              │                    │      from natural language        │
│              │                    │  4b. Submits to worker queue     │
│              │                    │  4c. Worker executes the piece   │
│              │                    │      action                      │
│              │                    │                                  │
│              │                    │  For FLOW tools:                 │
│              │                    │  4a. Maps parameters to flow     │
│              │                    │      trigger inputs              │
│              │                    │  4b. Triggers the flow via       │
│              │                    │      webhook handler             │
│              │                    │  4c. Waits for flow to complete  │
│              │                    │                                  │
│              │  tool_result:      │  5. Returns result to client     │
│              │  "Message sent"    │                                  │
│              │ ◀──────────────────│                                  │
└──────────────┘                    └──────────────────────────────────┘
```

**What this diagram means:**

1. Claude Desktop connects to your Activepieces MCP server using **SSE (Server-Sent Events)** - a way to keep a connection open so the server can push messages to the client.

2. The token in the URL authenticates the connection - the server looks up which MCP configuration and tools belong to this token.

3. When Claude decides to use a tool (e.g., "send_message"), it sends a tool call.

4. For **PIECE tools**: The AI receives just a natural language `instructions` string (e.g., "send 'hello' to #general"). It uses **GPT-4.1** (via the configured AI provider) to extract structured parameters from the instructions (channel = "#general", message = "hello"). Then it executes the piece action through the normal worker queue.

5. For **FLOW tools**: The parameters are already structured (matching the flow's input schema). The server triggers the flow via the webhook handler, waits for it to finish, and returns the result.

### MCP Database Schema

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     MCP      │       │   McpTool    │       │   McpRun     │
├──────────────┤  1:N  ├──────────────┤       ├──────────────┤
│ id           │◄─────▶│ id           │       │ id           │
│ name         │       │ mcpId        │       │ mcpId        │
│ projectId    │       │ type         │       │ toolId       │
│ token        │       │  (PIECE or   │       │ projectId    │
│ externalId   │       │   FLOW)      │       │ input        │
│              │       │ pieceMetadata│       │ output       │
│              │       │  (for PIECE) │       │ status       │
│              │       │ flowId       │       │  (SUCCESS or │
│              │       │  (for FLOW)  │       │   FAILED)    │
└──────────────┘       └──────────────┘       └──────────────┘
```

### MCP Session Management

When multiple server instances are running, MCP sessions need to be coordinated via Redis pub/sub. The `mcpSessionManager` stores sessions in memory and uses Redis to synchronize across instances:
- When a client connects, a session is created locally
- Session info is published to Redis so other instances know about it
- When a tool call comes in on a different instance, Redis routes it to the correct instance

### Key Files

- MCP module: `packages/server/api/src/app/mcp/mcp-module.ts`
- MCP service (CRUD): `packages/server/api/src/app/mcp/mcp-service.ts`
- MCP server (tool registration): `packages/server/api/src/app/mcp/mcp-server/mcp-server.ts`
- MCP SSE controller: `packages/server/api/src/app/mcp/mcp-server/mcp-sse-controller.ts`
- MCP session manager: `packages/server/api/src/app/mcp/mcp-server/mcp-session-manager.ts`
- MCP entity: `packages/server/api/src/app/mcp/mcp-server/mcp-entity.ts`
- MCP tool entity: `packages/server/api/src/app/mcp/tool/mcp-tool.entity.ts`
- Tool input resolver (AI): `packages/server/api/src/app/mcp/tool/tool-inputs-resolver.ts`
- MCP run entity: `packages/server/api/src/app/mcp/mcp-run/mcp-run.entity.ts`

---

## 17. Worker & Queue System

### Why Do We Need Workers?

When a flow needs to run, you don't want the API server to do it directly. Why?
1. Flows can take minutes to complete. You can't keep an HTTP request open that long.
2. If 1000 flows trigger at once, the API server would be overwhelmed.
3. If a flow crashes, it shouldn't take down the API server.

So instead, the API server puts a "job" into a queue (Redis), and a separate **worker** process picks it up.

```
┌──────────────────────────────────────────────────────────────┐
│                    WORKER SYSTEM                              │
│                                                               │
│  ┌────────────┐         ┌──────────────────────────────┐     │
│  │ API Server │         │       Redis (BullMQ)          │     │
│  │            │ enqueue │                               │     │
│  │ Creates    │────────▶│  ┌─────────────────────────┐ │     │
│  │ FlowRun   │         │  │ Flow Execution Queue     │ │     │
│  │ job        │         │  │ (EXECUTE_FLOW)           │ │     │
│  └────────────┘         │  ├─────────────────────────┤ │     │
│                         │  │ Polling Trigger Queue    │ │     │
│                         │  │ (EXECUTE_POLLING)        │ │     │
│                         │  ├─────────────────────────┤ │     │
│                         │  │ Repeating Jobs           │ │     │
│                         │  │ (Cron schedules)         │ │     │
│                         │  └────────────┬────────────┘ │     │
│                         └───────────────┼──────────────┘     │
│                                         │ dequeue            │
│                                         ▼                    │
│                         ┌───────────────────────────────┐    │
│                         │  Job Queue Worker              │    │
│                         │  (BullMQ Consumer)             │    │
│                         │                                │    │
│                         │  Pre-checks:                   │    │
│                         │  - Is flow still enabled?      │    │
│                         │  - Rate limiting                │    │
│                         │  - Schema migration            │    │
│                         │                                │    │
│                         │  Routes to executor:           │    │
│                         │  - flowJobExecutor             │    │
│                         │  - executeTriggerExecutor      │    │
│                         └───────────────┬───────────────┘    │
│                                         │                    │
│                                         ▼                    │
│                         ┌───────────────────────────────┐    │
│                         │  Engine Runner Socket          │    │
│                         │  (Socket.IO client)            │    │
│                         │                                │    │
│                         │  Sends the flow definition     │    │
│                         │  to the Engine process via     │    │
│                         │  Socket.IO                     │    │
│                         │                                │    │
│                         │  Receives back:                │    │
│                         │  - Step-by-step progress       │    │
│                         │  - Final result                │    │
│                         │  - Console output (stdout)     │    │
│                         └───────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**What this diagram means:**

**Left side (API Server)**: When a trigger fires or a user clicks "Test," the API server creates a FlowRun record in PostgreSQL and puts a job message into the Redis queue. Then it immediately returns an HTTP response to the client ("run started"). It does NOT wait for the flow to finish.

**Middle (Redis/BullMQ)**: Redis acts as a reliable queue. There are different types of jobs:
- `EXECUTE_FLOW`: Run a specific flow with specific data
- `EXECUTE_POLLING`: Check a polling trigger for new data
- `Repeating Jobs`: Cron-scheduled jobs (like "check every 5 minutes")

BullMQ guarantees that jobs aren't lost - even if the worker crashes, the job stays in Redis and gets retried.

**Right side (Worker)**: The worker process constantly watches the Redis queue. When a job appears:
1. **Pre-checks**: Is the flow still enabled? (Maybe the user disabled it while the job was queued.) Is the project within its rate limits?
2. **Route to executor**: Flow execution jobs go to `flowJobExecutor`, polling trigger jobs go to `executeTriggerExecutor`.
3. **Engine communication**: The worker sends the flow definition to the Engine process via Socket.IO. The Engine is a separate sandboxed Node.js process that actually runs the steps. The worker receives progress updates and saves them to the database.

### Key Files

- Worker init: `packages/server/worker/src/lib/flow-worker.ts`
- Job queue worker: `packages/server/worker/src/lib/consume/job-queue-worker.ts`
- Flow job executor: `packages/server/worker/src/lib/consume/executors/flow-job-executor.ts`
- Engine runner socket: `packages/server/worker/src/lib/compute/engine-runner-socket.ts`

---

## 18. Frontend Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      REACT UI (Vite SPA)                          │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Router (React Router DOM)                                 │   │
│  │                                                            │   │
│  │  /sign-in, /sign-up     → Auth pages                       │   │
│  │  /flows                 → Flow list (all your flows)       │   │
│  │  /flows/:id             → FLOW BUILDER (the main feature)  │   │
│  │  /runs                  → Run history (see past executions)│   │
│  │  /connections           → Manage API keys & OAuth tokens   │   │
│  │  /settings              → Project and platform settings    │   │
│  │  /tables                → Built-in database tables         │   │
│  │  /todos                 → Task management                  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  FLOW BUILDER (/flows/:id)                                 │   │
│  │                                                            │   │
│  │  ┌──────────────────┐  ┌──────────────────────────────┐   │   │
│  │  │  Toolbar          │  │  React Flow Canvas           │   │   │
│  │  │  (Publish, Test,  │  │  (@xyflow/react)             │   │   │
│  │  │   Undo, Redo)     │  │                              │   │   │
│  │  └──────────────────┘  │  ┌─────┐    ┌─────┐          │   │   │
│  │                         │  │Trig │───▶│Step │──▶ ...   │   │   │
│  │  ┌──────────────────┐  │  │ger  │    │  2  │          │   │   │
│  │  │  Step Settings   │  │  └─────┘    └─────┘          │   │   │
│  │  │  Sidebar         │  │                              │   │   │
│  │  │  (Props, Auth,   │  │  Drag to add steps           │   │   │
│  │  │   Test, Output)  │  │  Click to select/edit        │   │   │
│  │  └──────────────────┘  └──────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  State Management:                                                │
│  ┌──────────────────┐  ┌──────────────────────────────────┐      │
│  │  Zustand Store    │  │  TanStack Query                  │      │
│  │  (Local state:    │  │  (Server state:                  │      │
│  │   which step is   │  │   flows, runs, connections       │      │
│  │   selected, is    │  │   - fetches from API             │      │
│  │   sidebar open,   │  │   - caches results               │      │
│  │   canvas zoom)    │  │   - auto-refetches on change)    │      │
│  └──────────────────┘  └──────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

**What this diagram means:**

The frontend is a **Single Page Application (SPA)** - one HTML page that dynamically changes content based on the URL. When you navigate to `/flows`, React renders the flow list. When you click a flow, React renders the flow builder without a full page reload.

**React Flow Canvas**: This is the main feature. It uses the `@xyflow/react` library to render a visual graph where:
- **Nodes** = Steps (trigger, actions, routers, loops)
- **Edges** = Arrows connecting steps
- You can drag to pan, scroll to zoom, click to select, right-click for context menu

**Two State Management Systems**:
- **Zustand**: Manages UI-only state that doesn't need to be saved to the server. Which step is selected? Is the sidebar open? What's the zoom level?
- **TanStack Query**: Manages data from the server. "What flows exist?" "What are the run results?" It fetches from the API, caches results, and automatically re-fetches when data might have changed.

### Key Files

- Builder page: `packages/react-ui/src/app/routes/flows/id/index.tsx`
- Flow canvas: `packages/react-ui/src/app/builder/flow-canvas/index.tsx`
- Step nodes: `packages/react-ui/src/app/builder/flow-canvas/nodes/step-node.tsx`
- Builder state: `packages/react-ui/src/app/builder/builder-state-provider.tsx`

---

## 19. Database Schema

All the key tables in PostgreSQL:

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│   platform   │     │     user     │     │  user_identity   │
├──────────────┤     ├──────────────┤     ├─────────────────┤
│ id           │◄───┐│ id           │────▶│ id              │
│ name         │    ││ platformId   │     │ email           │
│ ownerId      │    ││ identityId   │     │ password        │
│ primaryColor │    ││ platformRole │     │ provider        │
│ emailAuth    │    ││ status       │     │ tokenVersion    │
│ ssoConfig    │    │└──────────────┘     └─────────────────┘
│ plan         │    │
└──────────────┘    │  ┌───────────────┐    ┌────────────────┐
                    │  │   project     │    │ project_member  │
                    │  ├───────────────┤    ├────────────────┤
                    └──│ platformId    │    │ projectId      │
                       │ ownerId       │    │ userId         │
                       │ displayName   │    │ platformId     │
                       └───────┬───────┘    │ role           │
                               │            └────────────────┘
                    ┌──────────┼──────────┐
                    │          │          │
              ┌─────▼───┐ ┌───▼────┐ ┌───▼──────────┐
              │  flow    │ │ table  │ │app_connection │
              ├─────────┤ ├────────┤ ├──────────────┤
              │projectId│ │projectId│ │ projectId    │
              │status   │ │name    │ │ pieceName    │
              │published│ │fields  │ │ value (enc.) │
              │VersionId│ │        │ │ status       │
              └────┬────┘ └────────┘ └──────────────┘
                   │
          ┌────────┼────────┐
          │                 │
    ┌─────▼──────┐   ┌─────▼─────┐
    │flow_version│   │ flow_run  │
    ├────────────┤   ├───────────┤
    │ flowId     │   │ flowId    │
    │ trigger    │   │ versionId │
    │ (JSON tree)│   │ status    │
    │ state      │   │ duration  │
    │ valid      │   │ logsFileId│
    └────────────┘   └───────────┘
```

**Reading this diagram:**

- Arrows with `◄───▶` mean "references" (foreign keys). A `user` has a `platformId` that points to a `platform`. A `project` has a `platformId` too.
- The hierarchy goes: Platform → has many Projects → each project has many Flows, Tables, and App Connections.
- Each Flow has many FlowVersions (edit history) and FlowRuns (execution history).
- `app_connection` stores encrypted OAuth tokens and API keys (`value (enc.)`).

Additional tables not shown: `mcp`, `mcp_tool`, `mcp_run`, `todo`, `todo_activity`, `field`, `record`, `cell`, `table_webhook`, `ai_provider`, `audit_event` (EE), `api_key` (EE), `project_release` (EE), and more.

There are **416+ database migrations** in `packages/server/api/src/app/database/migration/`.

---

## 20. Enterprise Edition

Enterprise features are conditionally loaded based on the `AP_EDITION` environment variable (`CE`, `EE`, or `CLOUD`):

| Feature | Community (Free) | Enterprise (Paid) |
|---------|:-:|:-:|
| Basic RBAC (Owner/Editor/Viewer) | Yes | Yes |
| Custom roles with granular permissions | - | Yes |
| SAML SSO | - | Yes |
| Audit logs | - | Yes |
| Custom domains | - | Yes |
| Project releases (versioned deployments) | - | Yes |
| Environments (dev/staging/prod) | - | Yes |
| Global connections (shared across projects) | - | Yes |
| Analytics dashboard | - | Yes |
| API keys | - | Yes |
| Embed SDK (iframe embedding) | - | Yes |
| Git sync | - | Yes |
| Stripe billing | - | Yes |

---

## 21. End-to-End: Everything Connected

Here's the complete journey from AI prompt to running automation:

```
 USER types "When new GitHub issue → post to Slack"
       │
       ▼
 [React UI] ──POST /v1/opsyn/generate──▶ [Fastify API Server]
                                               │
                                               │ HTTP POST /generate-workflow
                                               ▼
                                         [Python FastAPI Server on Modal GPU]
                                               │
                                               │ Qwen2.5-7B + LoRA generates JSON
                                               │ Post-processor fixes names/versions
                                               │
 [React UI] ◀── FlowTemplate JSON ────────────┘
       │
       │ Creates flow, opens in builder
       ▼
 [React Flow Canvas] ── user edits steps ──▶ REST API
       │                                        │
       │                                        ▼
       │                              [FlowVersion DRAFT saved to PostgreSQL]
       │
       │  Socket.IO broadcasts changes to other editors
       │  in the same flow room (real-time collaboration)
       ▼
 User clicks PUBLISH
       │
       ▼
 [API Server] locks piece versions, creates LOCKED FlowVersion
       │
       │ Enables trigger:
       │  - Webhook? Register URL with GitHub
       │  - Polling? Create repeating Redis job
       │  - Schedule? Create cron Redis job
       ▼
 TRIGGER FIRES (e.g., new GitHub issue created)
       │
       ▼
 [API Server] creates FlowRun (status: QUEUED)
 [API Server] puts job into Redis queue
       │
       ▼
 [Worker] picks up job from Redis
 [Worker] sends flow to Engine via Socket.IO
       │
       ▼
 [Engine - Sandboxed Process]
   Step 1: Extract trigger payload (issue data)
   Step 2: Load @activepieces/piece-slack
           Resolve {{trigger.title}} → "Bug: login broken"
           Call slack.sendMessage({ channel: "#bugs", text: "Bug: login broken" })
   Step 3: ... more steps ...
       │
       │ Progress updates → Worker → PostgreSQL
       ▼
 [FlowRun] updated: status = SUCCEEDED, duration = 2.3s
```

**This is the complete picture.** Everything works together:
- **PostgreSQL** stores all the data
- **Redis** connects the API server to workers via job queues, and connects multiple server instances via pub/sub
- **Socket.IO** (inside Fastify) provides real-time updates to browsers
- **The Engine** runs in isolation for safety
- **The Python AI server** generates flows from English
- **React Flow** renders the visual builder
- **Pieces** provide the actual integrations with external services
