# Concert Reservation Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Next.js Version](https://img.shields.io/badge/next.js-16.0.1-blue)](https://nextjs.org/)
[![NestJS Version](https://img.shields.io/badge/nestjs-11.0.1-red)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-blue)](https://www.postgresql.org/)

Full-stack demo application for managing free concert tickets. The frontend is built with **Next.js 16** and Tailwind CSS 4, while the backend uses **NestJS 11** with TypeORM and PostgreSQL. Both admin and general users can browse concerts, reserve seats, and manage bookings with clear validation and error handling.

---

## 1. Project Overview

- **Landing & Navigation** – Next.js supplies the audience homepage, admin dashboard, login, and register experiences.  
- **Responsive UI** – Tailwind utility classes and small custom styles mirror the Figma design across mobile, tablet, and desktop.  
- **Free Concert Tickets CRUD** – NestJS backend exposes concerts, reservations, and users endpoints:  
  - Admins can create/delete concerts, inspect reservations, and review user histories.  
  - Users can browse every concert (including sold out), reserve a single seat, cancel, and view their own bookings.  
- **Validation & Error Handling** – DTO decorators plus the global `ValidationPipe` guarantee input correctness; the client surfaces server errors via inline feedback/snackbars.  
- **Unit Tests** – Jest specs span controllers, services, and DTO validation for concerts, reservations, and users.  
- **Bonus Notes** – Optional scaling ideas are captured in [Section 7](#7-bonus-considerations).

---

## 2. Architecture

```
concert-app/
├── client/                 # Next.js frontend (app router)
│   ├── app/                # Routes, layouts, shared config
│   ├── components/         # Reusable UI (modals, cards, layout)
│   ├── utils/              # HTTP helper, classNames util
│   └── tailwind config     # Tailwind 4 setup (globals.css)
├── server/                 # NestJS backend
│   ├── src/
│   │   ├── concerts/       # Concert CRUD + unit tests
│   │   ├── reservations/   # Reservation workflows + tests
│   │   ├── users/          # User CRUD/auth + history + tests
│   │   └── main.ts         # ValidationPipe, CORS, global prefix
├── docker-compose.yml      # Postgres 15 for local dev
├── scripts/check-db.js     # Simple connection check utility
└── package.json            # Root runner (concurrently start client+server)
```

Key runtime flow:

1. Frontend calls REST endpoints under `/api/*` (configurable via `NEXT_PUBLIC_API_BASE_URL`).  
2. Backend modules encapsulate domain logic: concerts, reservations, users. Services orchestrate TypeORM repositories with transactional updates (e.g., seat counts).  
3. PostgreSQL persists concerts/users/reservations; TypeORM auto-synchronizes schema in dev.  
4. Jest unit tests mock repositories to verify positive & negative cases (CRUD, validation, error propagation).

---

## 3. Tech Stack & Key Libraries

| Layer        | Libraries & Purpose |
|--------------|---------------------|
| Frontend     | Next.js 16 (App Router), React 19, TailwindCSS 4, Lucide Icons, custom hooks/utils |
| Backend      | NestJS 11, TypeORM 0.3, class-validator/transformer, PostgreSQL (via docker-compose) |
| Tooling      | Jest + @nestjs/testing, ESLint 9, Prettier, Concurrently (root runner) |

---

## 4. Setup & Local Development

### Prerequisites

- Node.js ≥ 18 (tested with 18 & 20)  
- npm (or pnpm/yarn)  
- Docker (optional but recommended for Postgres)

### 4.1 Clone & Install

```bash
git clone https://github.com/<your-org>/concert-app.git
cd concert-app
npm install          # installs root + client + server deps
```

> Alternatively run `npm install` inside `client/` and `server/` individually.

### 4.2 Start PostgreSQL

```bash
docker compose up -d
```

Defaults match `TypeOrmModule.forRoot`:

- Host `localhost`, Port `5432`  
- Database `concert_app`  
- Username `postgres`, Password `password`

To verify DB connectivity:

```bash
node scripts/check-db.js
```

### 4.3 Environment Variables

The project runs with built-in defaults:

- Frontend uses `API_BASE_URL` fallback to `http://localhost:3001/api` in `client/app/config.ts`.  
- Backend TypeORM connection settings (host, port, credentials) live in `server/src/app.module.ts`.

If you need different values, update those files or introduce your own `.env` handling—but the repository does not require any `.env` files out of the box.

### 4.4 Run the Stack

```bash
npm run dev
```

- Frontend → http://localhost:3000  
- Backend → http://localhost:3001/api

Individual commands:

```bash
# Frontend only
cd client && npm run dev

# Backend only
cd server && npm run start:dev
```

> **Registration note:** Signing up through the UI always provisions a standard `user` role. If you need an admin account, update the corresponding record’s role directly in the database.

---

## 5. Error Handling & Validation

- **DTO Decorators** (`class-validator`): enforce required fields, value ranges, enum states across concerts/reservations/users.  
- **Global ValidationPipe** (`main.ts`): strips unknown properties (`whitelist`), handles type coercion (`transform`) and returns 400 responses when invalid.  
- **Transactional safeguards**: Reservations service wraps seat updates in `dataSource.transaction`, ensuring consistency when decrementing/ incrementing seats.  
- **Client messaging**: login/register forms show inline errors from server responses; admin UI uses shared Snackbar/ConfirmModal to surface failures or confirmations.

---

## 6. Running Tests

Unit tests live alongside the Nest modules and DTOs.

```bash
cd server
npm run test          # run all unit specs
npm run test:cov      # optional coverage report
```

The suite covers:

- Service CRUD flows (including transactional seat logic and repository error propagation)  
- Controller delegation with mocked services  
- DTO validation guarantees for create/update payloads

---

## 7. Bonus Considerations

### 7.1 Handling Heavy Data & High Traffic

**Analysis.** When the catalogue and reservation history grow into the thousands, naive endpoints fetch everything at once and every request hits the database. Under a surge of concurrent users this creates large responses, repeated identical queries, and slow table scans—ultimately degrading request latency.

**Optimised approach.**

- **Paginate / Lazy load** concert and history endpoints so each response stays small.  
- **Cache hot reads** (e.g., concert listings) in Redis or in-memory to avoid repetitive database hits.  
- **Index query columns** such as `concert_id`, `user_id`, and `status` to keep lookups fast.  
- **Render on the server** (Next.js SSR/SSG) so users see content sooner while work shifts off the browser.  
- **Push static assets to a CDN** and plan for horizontal scaling with a load balancer once traffic spikes.

Together these changes keep request sizes manageable, reuse previously computed results, and ensure the database remains performant even as data volume and traffic increase.

---

### 7.2 Preventing Double Bookings During Ticket Rushes

**Analysis.** A ticket release attracts many simultaneous requests for the same concert. Without coordination, two users can reserve the last seat within milliseconds of each other, producing oversold shows or failed experiences.

**Optimised approach.**

- **Wrap reservations in transactions** so the “check seat → reserve seat → persist booking” sequence either completes atomically or rolls back.  
- **Apply database locking**—pessimistic (`SELECT … FOR UPDATE`) for strict mutual exclusion, or optimistic (version columns) to detect conflicting updates before commit.  
- **Serialize spikes via queues** (e.g., Redis + BullMQ) when traffic is extreme, ensuring seat updates run one at a time.  
- **Broadcast availability updates** using WebSockets or short polling so the UI reflects real-time inventory and discourages attempts on sold-out seats.  
- **Debounce client submissions** by disabling the “Reserve” button while a request is in-flight to avoid accidental duplicate calls.

With these safeguards the system honours first-come-first-served ordering, prevents overselling, and keeps every concert attendee in their seat instead of standing.

---

## 8. Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run dev --prefix client` | Frontend dev server |
| `npm run start:dev --prefix server` | Backend dev server with watch |
| `npm run build --prefix client` | Production build (frontend) |
| `npm run build --prefix server` | Compile NestJS to `dist/` |
| `npm run test --prefix server` | Execute backend unit tests |

> Use `npm run lint` in respective folders to run ESLint.

---