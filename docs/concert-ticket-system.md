## 1. Overview

**Free Concert Ticket System (Next.js + NestJS + Postgres)** is a full‑stack demo application that lets users register, sign in, and reserve free seats for concerts, while admins manage concerts and monitor reservation activity.

- **End users** can:
  - Create an account and log in.
  - View all available concerts and see remaining seats in real time.
  - Reserve or cancel a single seat per concert.
- **Admins** can:
  - Create and delete concerts.
  - See aggregate statistics (total seats, reserved seats, cancelled reservations).
  - View a full reservation history log.

The system is implemented as:

- A **Next.js 16** frontend app (`client`) with React 19 UI and Tailwind CSS for styling.
- A **NestJS 11** backend (`server`) exposing REST APIs under the `/api` prefix.
- **TypeORM** models backed by **PostgreSQL 15** (via Docker) for persistence and transactional seat updates.

**Frontend–backend interaction**

- The Next.js app calls the NestJS API using `fetch` to endpoints such as `/api/concerts`, `/api/reservations`, `/api/users`, and `/api/users/login`.
- The backend applies validation (via `class-validator` and global `ValidationPipe`), maps DTOs to TypeORM entities, and persists changes in Postgres.
- Reservation creation and status updates run inside transactions to keep `available_seats` in sync with reservation status and to safely handle concurrent requests.

---

## 2. System Architecture / Flow

**High‑level request pipeline**

- **Browser user** → **Next.js page (React component)** → `fetch("http://localhost:3001/api/...")` →
  **NestJS Controller** → **Service** → **TypeORM Repository** → **Postgres** → back through the same path as a JSON response.

**2.1 User journeys**

- **View concerts**
  - User (logged in) → `UserHomePage` (`client/app/page.tsx`) →
    `fetch("${API_BASE_URL}/concerts")` →
    `ConcertsController.findAll()` →
    `ConcertsService.findAll()` →
    `Repository<Concert>.find()` →
    `concerts` table →
    return `Concert[]` →
    React renders cards with `total_seats` and `available_seats`.

- **Reserve a seat (user flow)**
  - User clicks **Reserve** on a concert card →
    `UserHomePage.reserveSeat(concertId)` →
    `POST ${API_BASE_URL}/reservations` with `{ userId, concertId }` →
    `ReservationsController.create()` →
    `ReservationsService.create()` →
    `DataSource.transaction()`:
    - Load `User` and `Concert`.
    - Check no existing reservation for this user/concert.
    - If `concert.available_seats >= 1`, create `Reservation` with `status = "reserved"`.
    - Decrement `concert.available_seats` and save both entities.
    →
    committed to Postgres →
    status 201 response →
    client calls `refreshConcertsAndReservations()` and re-renders updated seat counts.

- **Cancel a reservation (user flow)**
  - User clicks **Cancel** on a reserved concert →
    `UserHomePage.cancelReservation(concertId)` →
    find existing `Reservation` for `(userId, concertId)` →
    `PUT ${API_BASE_URL}/reservations/:id` with `{ status: "cancelled" }` →
    `ReservationsController.update()` →
    `ReservationsService.update()`:
    - If current status is `"reserved"`, set `"cancelled"` and increment `concert.available_seats`.
    →
    values saved via repositories →
    updated row in Postgres →
    client refreshes concerts & reservations.

- **Admin: create concert**
  - Admin visits `/admin` (`AdminHomePage`) →
    fills form and submits →
    `POST ${API_BASE_URL}/concerts` with `{ name, description, totalSeats }` →
    `ConcertsController.create()` →
    `ConcertsService.create()`:
    - Create `Concert` with `total_seats = totalSeats`, `available_seats = totalSeats`.
    - Save via repository to `concerts` table.
    →
    client reloads list & statistics.

- **Admin: delete concert**
  - Admin clicks **Delete** → opens `ConfirmModal` →
    on confirm:
    - `DELETE ${API_BASE_URL}/concerts/:id` →
      `ConcertsController.remove()` →
      `ConcertsService.remove()`:
      - Load `Concert` or 404.
      - `Repository.remove()` deletes it (cascades to reservations via FK).

- **Admin: view reservation history**
  - Admin visits `/admin/history` (`AdminHistoryPage`) →
    `fetch("${API_BASE_URL}/reservations")` →
    `ReservationsController.findAll()` →
    `ReservationsService.findAll()` →
    `reservations` table with `relations: ['concert','user']` →
    JSON result →
    rendered as a table (datetime, user, concert, action).

**2.2 Example flow diagrams**

- **View concerts**

  - User → Next.js `UserHomePage` → `fetch("/api/concerts")` →
    `ConcertsController.findAll` → `ConcertsService.findAll` →
    `ConcertsRepository.find` → Postgres `concerts` → response.

- **Reserve seat**

  - User → Next.js `UserHomePage.reserveSeat` → `POST /api/reservations` →
    `ReservationsController.create` → `ReservationsService.create` (transaction) →
    `ReservationsRepository` + `ConcertsRepository` → Postgres (`reservations`, `concerts`) → response.

- **Cancel reservation**

  - User → `UserHomePage.cancelReservation` → `PUT /api/reservations/:id` →
    `ReservationsController.update` → `ReservationsService.update` →
    `ReservationsRepository` + `ConcertsRepository` → Postgres update → response.

- **Admin manage concerts**

  - Admin → Next.js `AdminHomePage` (Overview / Create) →
    `fetch("/api/concerts")`, `POST /api/concerts`, `DELETE /api/concerts/:id` →
    `ConcertsController` → `ConcertsService` → `ConcertsRepository` → Postgres.

---

## 3. Tech Stack

**Backend**

- NestJS 11 (`@nestjs/common`, `@nestjs/core`) for modular API structure.
- `@nestjs/typeorm` and `typeorm` for data access and transactions.
- PostgreSQL 15 (via Docker `postgres:15` image in `docker-compose.yml`).
- `class-validator` + `class-transformer` with global `ValidationPipe`.

**Frontend**

- Next.js 16 (`client` app) with React 19.
- Tailwind CSS 4 for styling.
- `lucide-react` for icons.

**Infrastructure / tooling**

- Docker Compose for local Postgres.
- TypeScript 5 (client and server).
- ESLint and Prettier for linting/formatting.

**3.1 Libraries table**

| Library            | Purpose                                                | Example usage                                                                 |
|--------------------|--------------------------------------------------------|-------------------------------------------------------------------------------|
| **Next.js**        | React app framework for the client UI                  | Pages under `client/app` like `page.tsx`, `admin/page.tsx`                   |
| **React**          | Component model and state management                   | Hooks such as `useState`, `useEffect` in page components                     |
| **NestJS**         | Structured backend framework with modules/controllers  | `ConcertsModule`, `ReservationsModule`, `UsersModule`                        |
| **TypeORM**        | ORM for Postgres, entities, repositories, transactions | Entities: `Concert`, `User`, `Reservation`; `DataSource.transaction()`       |
| **PostgreSQL**     | Persistent relational database                         | `concert_app` DB with `concerts`, `users`, `reservations` tables             |
| **Docker**         | Containerized Postgres for local development           | `docker-compose.yml` with `postgres:15` service                              |
| **class-validator**| Request DTO validation                                 | `CreateConcertDto`, `CreateReservationDto`, `CreateUserDto`, `LoginUserDto`  |
| **Tailwind CSS**   | Utility CSS framework for UI styling                   | Classes like `rounded-lg`, `bg-sky-600`, `text-zinc-700`                     |
| **lucide-react**   | Icon library for React                                 | Icons like `<House />`, `<LogOut />`, `<User />` in sidebar and cards        |

### 3.2 TypeORM in this project

- **Configuration**
  - Defined in `AppModule` via `TypeOrmModule.forRoot({...})` with:
    - `type: 'postgres'`, `host: 'localhost'`, `port: 5432`
    - `username: 'postgres'`, `password: 'password'`, `database: 'concert_app'`
    - `synchronize: true` (auto‑creates tables during development)
    - `autoLoadEntities: true` (automatically picks up entities from imported modules).
  - Each feature module imports its own entities using `TypeOrmModule.forFeature([EntityClass])`, which injects repositories into services.

- **Entities and repositories**
  - `Concert`, `User`, and `Reservation` are plain TypeScript classes decorated with `@Entity()`, `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, `@OneToMany`, etc.
  - In services, repositories are injected with `@InjectRepository(Entity)` and used for:
    - CRUD operations (`find`, `findOne`, `save`, `remove`).
    - Loading relations (e.g., `relations: ['concert', 'user']` when returning reservations).

- **Transactions**
  - Some operations (notably `ReservationsService.create`) use `DataSource.transaction` to:
    - Look up user and concert in a consistent snapshot.
    - Check for existing reservations.
    - Validate `available_seats`.
    - Create a new reservation and update the concert’s `available_seats` together.
  - This ensures **atomicity**: either all changes succeed, or none are committed, which is critical for seat counting under concurrency.

- **QueryBuilder usage**
  - `UsersService.authenticate` uses `createQueryBuilder` to fetch a user **including** the password column (which is excluded by default) using `.addSelect('user.password')`.

### 3.3 Docker and database lifecycle

- **Postgres via Docker Compose**
  - `docker-compose.yml` defines a single `postgres` service:
    - Image: `postgres:15`
    - Environment:
      - `POSTGRES_USER=postgres`
      - `POSTGRES_PASSWORD=password`
      - `POSTGRES_DB=concert_app`
    - Port mapping: `5432:5432`
    - Named volume `pgdata` for persistent storage.
  - This matches the TypeORM configuration in `AppModule`, so running `docker compose up -d` brings up a ready Postgres instance for the NestJS server.

- **Local development flow**
  - Start database: `docker compose up -d` (from the repo root).
  - Start backend: `cd server && npm run start:dev` (NestJS connects to the Dockerized Postgres).
  - Start frontend: `cd client && npm run dev` (Next.js uses `API_BASE_URL` pointing at the NestJS server).

- **Lifecycle considerations**
  - The `pgdata` volume ensures data persists across container restarts.
  - For a clean slate during development, developers can remove the volume (`docker volume rm concert-app_pgdata`) and restart the stack, letting TypeORM re‑create tables via `synchronize: true`.

### 3.4 Testing and unit tests

- **Testing stack**
  - The backend uses **Jest** as configured in `server/package.json` and the embedded `jest` config:
    - Tests are TypeScript files matching `*.spec.ts` under `src`.
    - `ts-jest` compiles TypeScript on the fly.
    - The test environment is Node, with coverage stored in `coverage/`.
  - Standard scripts:
    - `npm test` — run the full Jest suite.
    - `npm run test:watch` — watch mode for development.
    - `npm run test:cov` — collect coverage.

- **Existing spec files**
  - `app.controller.spec.ts` — basic health or greeting tests for the root controller.
  - `concerts.controller.spec.ts`, `concerts.service.spec.ts` — cover concert CRUD controller and service behaviours.
  - `reservations.controller.spec.ts`, `reservations.service.spec.ts` — cover reservation flows.
  - `users.controller.spec.ts`, `users.service.spec.ts` — cover user CRUD and authentication.

- **What is typically tested**
  - Controllers:
    - Status codes and response shapes for success and failure.
    - That controller methods delegate correctly to their services.
  - Services:
    - Business rules such as:
      - Rejecting over‑booking (`available_seats < 1`).
      - Preventing duplicate reservations per user/concert.
      - Seat count adjustments on cancel and delete.
    - Error paths (e.g., `NotFoundException`, `BadRequestException`, `UnauthorizedException`).

- **Opportunities for deeper tests**
  - Add tests simulating concurrent reservations (using mocked repositories or an in‑memory database) to validate the transactional logic.
  - Add integration tests (e2e) using Supertest against a running NestJS app and a dedicated test database.
  - Expand coverage around edge cases listed in section 7 (pagination, security hardening, etc.).

---

## 4. Core Features

### 4.1 Concert CRUD

**Entity**

- `Concert` (`server/src/concerts/entities/concert.entity.ts`):
  - `id: number`
  - `name: string`
  - `description: string`
  - `total_seats: number`
  - `available_seats: number`
  - One‑to‑many `reservations: Reservation[]`

**DTOs**

- `CreateConcertDto`
  - `name: string` (required, non‑empty string)
  - `description: string` (required, non‑empty string)
  - `totalSeats: number` (required, positive int)
- `UpdateConcertDto` (partial)
  - May include `name`, `description`, and/or `totalSeats` (positive int).

**Service behaviour**

- **Create**

  ```ts
  async create(dto: CreateConcertDto) {
    const concert = concertsRepository.create({
      name: dto.name,
      description: dto.description,
      total_seats: dto.totalSeats,
      available_seats: dto.totalSeats, // all seats available initially
    });
    return concertsRepository.save(concert);
  }
  ```

- **Find all / one**

  - `findAll()` returns all concerts ordered by `id ASC`.
  - `findOne(id)` throws `NotFoundException` if the concert does not exist.

- **Update**

  - Allows updating `name`, `description`, and `totalSeats`.
  - Before lowering `totalSeats`, it computes `reservedSeats = total_seats - available_seats`.
  - If `dto.totalSeats < reservedSeats`, it throws `BadRequestException`:

    ```ts
    const reservedSeats = concert.total_seats - concert.available_seats;
    if (dto.totalSeats < reservedSeats) {
      throw new BadRequestException(
        `Cannot set total seats below currently reserved seats (${reservedSeats})`,
      );
    }
    concert.total_seats = dto.totalSeats;
    concert.available_seats = dto.totalSeats - reservedSeats;
    ```

- **Delete**

  - `remove(id)`:
    - Loads the concert via `findOne(id)` (404 if missing).
    - Calls `concertsRepository.remove(concert)` to delete the row.
    - Reservations are removed cascaded via the `ManyToOne` relationships on `Reservation`.

### 4.2 Reservation system and seat decrement logic

**Entity**

- `Reservation` (`server/src/reservations/entities/reservation.entity.ts`):
  - `id: number`
  - `user: User` (many‑to‑one, cascade delete)
  - `concert: Concert` (many‑to‑one, cascade delete)
  - `status: 'reserved' | 'cancelled'` (default `'reserved'`)
  - `created_at: Date` (auto timestamp)

**DTOs**

- `CreateReservationDto`
  - `userId: number` (positive int)
  - `concertId: number` (positive int)
- `UpdateReservationDto`
  - `status: 'reserved' | 'cancelled'` (enum)

**Create reservation (core logic)**

- Implemented in `ReservationsService.create()` using `DataSource.transaction`:

  ```ts
  async create(dto: CreateReservationDto): Promise<Reservation> {
    return dataSource.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const concertsRepo = manager.getRepository(Concert);
      const reservationsRepo = manager.getRepository(Reservation);

      const user = await usersRepo.findOne({ where: { id: dto.userId } });
      if (!user) throw new NotFoundException(`User with id ${dto.userId} not found`);

      const concert = await concertsRepo.findOne({ where: { id: dto.concertId } });
      if (!concert) throw new NotFoundException(`Concert with id ${dto.concertId} not found`);

      const existing = await reservationsRepo.findOne({
        where: { user: { id: user.id }, concert: { id: concert.id } },
      });
      if (existing) {
        throw new BadRequestException('User already has a reservation for this concert');
      }

      if (concert.available_seats < 1) {
        throw new BadRequestException('No seats available for this concert');
      }

      const reservation = reservationsRepo.create({ user, concert, status: 'reserved' });
      concert.available_seats -= 1;

      await concertsRepo.save(concert);
      return reservationsRepo.save(reservation);
    });
  }
  ```

**Update reservation status**

- Implemented in `ReservationsService.update(id, dto)`:

  - If the requested status is the same as the current one, it returns early.
  - Transition from `"reserved"` → `"cancelled"`:
    - Set `reservation.status = 'cancelled'`.
    - Increment `reservation.concert.available_seats` by 1.
    - Save concert and reservation.
  - Transition from `"cancelled"` → `"reserved"`:
    - If `available_seats < 1`, throw `BadRequestException('No seats available to reinstate...')`.
    - Decrement `available_seats`, set status to `'reserved'`, save both.
  - Any other combination throws `'Unsupported reservation status transition'`.

**Delete reservation**

- `ReservationsService.remove(id)`:
  - Loads the reservation via `findOne(id)`.
  - If status is still `'reserved'`, increments `available_seats` by 1 on the associated concert.
  - Saves the concert and removes the reservation.

### 4.3 User module

**Entity**

- `User` (`server/src/users/entities/user.entity.ts`):
  - `id: number`
  - `name: string`
  - `email: string` (unique)
  - `password: string` (column excluded from default queries via `select: false`)
  - `role: 'admin' | 'user'` (simple enum, default `'user'`)
  - One‑to‑many `reservations: Reservation[]`

**DTOs**

- `CreateUserDto`: `name`, `email`, `password` (min length 6), optional `role`.
- `UpdateUserDto`: all fields optional, with validation.
- `LoginUserDto`: `email`, `password`.

**Service behaviour**

- **Create user**
  - `UsersService.create(dto)`:
    - Creates a `User` entity with raw password (no hashing in this demo).
    - Persists via repository.
    - Returns a password‑stripped object (`SafeUser`) via `sanitizeUser()`.

- **Find users**
  - `findAll()` and `findOne(id)` return sanitized `SafeUser` objects.

- **Update user / delete user**
  - `update(id, dto)` merges allowed updates and returns the sanitized updated user.
  - `remove(id)` deletes the user, cascading deletion of any reservations.

- **Authenticate**

  - `UsersService.authenticate(email, password)`:

    ```ts
    const user = await usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return sanitizeUser(user);
    ```

  - The frontend stores the returned user (without password) in `localStorage` as `authUser`.
  - There is **no JWT or session**, only this simple client‑side login state.

- **Reservation history per user**
  - `UsersService.getReservationHistory(id)`:
    - First ensures the user exists.
    - Then queries `Reservation` with `where: { user: { id } }`, including `concert` and `user` relations and ordering by `created_at DESC`.

### 4.4 Concurrency handling

**Reservation creation**

- `ReservationsService.create()` runs inside `dataSource.transaction(...)`.
- Using the transactional `EntityManager` ensures:
  - The check for existing reservation.
  - The seat availability check (`concert.available_seats < 1`).
  - The creation of the reservation and the decrement of `available_seats`.
  - All succeed or fail as a unit.

**Status updates and deletes**

- Status updates (`update`) and deletions (`remove`) are not wrapped in explicit transactions, but each operation:
  - Loads the reservation + concert.
  - Adjusts `available_seats` based on the transition.
  - Saves both entities.
- Because Postgres guarantees row‑level locking per write, typical traffic patterns will behave correctly; however, high‑contention scenarios are described in the Edge Cases section.

**Frontend behaviour**

- The client never mutates `available_seats` directly.
- After any successful reservation or cancellation, the pages call `refreshConcertsAndReservations()` to re‑fetch from the backend and display authoritative seat counts.

---

## 5. Data Model / ER Diagram

Conceptually, the ER diagram is:

- `User` 1‑* `Reservation` *‑1 `Concert`

### 5.1 `users` table

- **Columns**
  - `id` (PK, `serial`)
  - `name` (`varchar`, not null)
  - `email` (`varchar`, unique, not null)
  - `password` (`varchar`, not null, not selected by default)
  - `role` (`enum`, `'admin' | 'user'`, default `'user'`)

- **Relationships**
  - One‑to‑many with `reservations.user` (`Reservation.user` has FK to `users.id`).
  - `onDelete: 'CASCADE'` via the `Reservation` entity definition.

### 5.2 `concerts` table

- **Columns**
  - `id` (PK, `serial`)
  - `name` (`varchar`, not null)
  - `description` (`varchar`, not null)
  - `total_seats` (`int`, not null)
  - `available_seats` (`int`, not null)

- **Relationships**
  - One‑to‑many with `reservations.concert` (`Reservation.concert` has FK to `concerts.id`).
  - `onDelete: 'CASCADE'` via the `Reservation` entity definition.

### 5.3 `reservations` table

- **Columns**
  - `id` (PK, `serial`)
  - `userId` (FK to `users.id`)
  - `concertId` (FK to `concerts.id`)
  - `status` (`varchar`, `'reserved' | 'cancelled'`, default `'reserved'`)
  - `created_at` (`timestamp`, auto‑generated)

- **Relationships**
  - Many‑to‑one to `users` (each reservation belongs to one user).
  - Many‑to‑one to `concerts` (each reservation belongs to one concert).
  - Both FKs are `onDelete: 'CASCADE'`, so deleting users or concerts automatically removes related reservations.

---

## 6. API Endpoints

All endpoints are exposed under the `/api` prefix, as configured in `main.ts`:

- Base URL for backend: `http://localhost:3001/api`

### 6.1 Concerts

**Base path**: `/concerts`

- **POST `/concerts`** — Create a concert

  - **Request body**

    ```json
    {
      "name": "Rock Night",
      "description": "A night of rock music.",
      "totalSeats": 100
    }
    ```

  - **Response 201**

    ```json
    {
      "id": 1,
      "name": "Rock Night",
      "description": "A night of rock music.",
      "total_seats": 100,
      "available_seats": 100
    }
    ```

  - **Error cases**
    - 400 if validation fails (`name`, `description`, `totalSeats` missing/invalid).

- **GET `/concerts`** — List all concerts

  - **Response 200**

    ```json
    [
      {
        "id": 1,
        "name": "Rock Night",
        "description": "A night of rock music.",
        "total_seats": 100,
        "available_seats": 20
      },
      {
        "id": 2,
        "name": "Jazz Evening",
        "description": "Smooth jazz.",
        "total_seats": 50,
        "available_seats": 0
      }
    ]
    ```

- **GET `/concerts/:id`** — Get concert details

  - **Parameters**
    - `id` — path param, integer.
  - **Response 200**

    ```json
    {
      "id": 1,
      "name": "Rock Night",
      "description": "A night of rock music.",
      "total_seats": 100,
      "available_seats": 20
    }
    ```

  - **Error cases**
    - 404 if concert not found.

- **PUT `/concerts/:id`** — Update a concert

  - **Request body (any subset of fields)**

    ```json
    {
      "name": "Rock Night (Updated)",
      "description": "Updated description.",
      "totalSeats": 120
    }
    ```

  - **Behaviour**
    - Recomputes `available_seats` while preserving existing reservations.
    - Throws 400 if `totalSeats` is less than already reserved seats.

- **DELETE `/concerts/:id`** — Delete a concert

  - Deletes the concert and its related reservations.
  - Returns 200/204 (no body) depending on Nest defaults; the frontend only checks `response.ok`.

### 6.2 Reservations

**Base path**: `/reservations`

- **POST `/reservations`** — Create a reservation

  - **Request body**

    ```json
    {
      "userId": 3,
      "concertId": 1
    }
    ```

  - **Behaviour**
    - Inside a transaction:
      - Verifies user and concert exist.
      - Ensures the user does not already have a reservation for this concert.
      - Ensures `available_seats > 0`.
      - Creates a `Reservation` with `status = "reserved"` and decrements `available_seats`.

  - **Response 201**

    ```json
    {
      "id": 10,
      "status": "reserved",
      "created_at": "2025-01-01T12:00:00.000Z",
      "user": { "id": 3, "name": "Jane", "email": "jane@example.com" },
      "concert": {
        "id": 1,
        "name": "Rock Night",
        "description": "A night of rock music.",
        "total_seats": 100,
        "available_seats": 19
      }
    }
    ```

  - **Error cases**
    - 404 if user or concert not found.
    - 400 if:
      - User already reserved this concert.
      - No seats available.

- **GET `/reservations`** — List all reservations

  - **Response 200**

    ```json
    [
      {
        "id": 10,
        "status": "reserved",
        "created_at": "2025-01-01T12:00:00.000Z",
        "user": { "id": 3, "name": "Jane", "email": "jane@example.com" },
        "concert": {
          "id": 1,
          "name": "Rock Night",
          "description": "A night of rock music.",
          "total_seats": 100,
          "available_seats": 19
        }
      }
    ]
    ```

- **GET `/reservations/:id`** — Get a reservation by id

  - 404 if not found.

- **GET `/reservations/user/:userId`** — Get reservations for a specific user

  - Returns reservations filtered by `user.id = userId`, ordered by `created_at DESC`.

- **PUT `/reservations/:id`** — Update reservation status

  - **Request body**

    ```json
    { "status": "cancelled" }
    ```

    or

    ```json
    { "status": "reserved" }
    ```

  - **Behaviour**
    - `"reserved"` → `"cancelled"`:
      - Marks reservation cancelled and increments `concert.available_seats`.
    - `"cancelled"` → `"reserved"`:
      - If `available_seats > 0`, decrements and sets status to `"reserved"`.
    - Any unsupported transition throws 400.

- **DELETE `/reservations/:id`** — Delete reservation

  - If the reservation is currently `"reserved"`, increments `available_seats` before deletion.

### 6.3 Users

**Base path**: `/users`

- **POST `/users`** — Create user (register)

  - **Request body**

    ```json
    {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "password": "secret123",
      "role": "user"
    }
    ```

  - **Response 201**

    ```json
    {
      "id": 3,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "user"
    }
    ```

  - Password is **never** returned.

- **GET `/users`** — List users

  - Returns sanitized users (no password).

- **GET `/users/:id`** — Get a user

  - 404 if not found.

- **PUT `/users/:id`** — Update a user

  - Accepts partial updates for `name`, `email`, `password`, and `role`.

- **DELETE `/users/:id`** — Delete user

  - Cascades to delete associated reservations.

- **POST `/users/login`** — Authenticate user

  - **Request body**

    ```json
    {
      "email": "jane@example.com",
      "password": "secret123"
    }
    ```

  - **Response 200**

    ```json
    {
      "id": 3,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "user"
    }
    ```

  - **Error cases**
    - 401 if email or password invalid (`UnauthorizedException`).

- **GET `/users/:id/reservations`** — Reservation history for a user

  - Returns reservations with populated `user` and `concert`.
  - Used in backend; the admin UI currently reads reservation history via `/reservations`.

---

## 7. Edge Cases, Limitations, TODO

### 7.1 Concurrency and race conditions

- The core reservation flows already use database transactions and consistent seat‑adjustment logic (see section 4.4) so that `available_seats` stays in sync with actual reservations and overselling is avoided.
- Section 7.6 builds on this by outlining additional patterns (locking, queues, rate limiting, real‑time updates) that can be applied when traffic and contention increase.

### 7.2 Security limitations

- **No real authentication or authorization**
  - Passwords are stored as plain text (no hashing).
  - There are no JWTs or sessions; the client keeps a `SafeUser` object in `localStorage` and uses it for role checks.
  - NestJS controllers do not enforce roles or authentication; any caller can hit admin endpoints if they know the URLs.
  - **Impact**: In a real environment, you must add:
    - Password hashing (e.g., bcrypt).
    - Auth guards / strategies (JWT, sessions).
    - Role‑based access control (RBAC) for admin routes.

### 7.3 Validation and UX limitations

- **No pagination**
  - `GET /concerts` and `GET /reservations` return all rows.
  - For many records, this may impact performance and UX; pagination or infinite scrolling would be a useful enhancement.

- **Limited server‑side validation of cross‑field rules**
  - DTOs validate basic types and ranges, but business rules (e.g., rate limiting reservations per user per day) are not implemented.

- **Error messaging**
  - The frontend reads error messages from API responses via `extractErrorMessage` and displays them in snackbars.
  - Some errors fall back to generic messages; detailed i18n or more granular error codes are not implemented.

### 7.4 Operational limitations / TODOs

- **Environment configuration**
  - Database connection is hard‑coded in `AppModule` to `localhost:5432` with fixed credentials.
  - TODO: externalize via environment variables for different environments (dev, staging, prod).

- **Migrations**
  - TypeORM uses `synchronize: true`, which is convenient for development but unsafe for production.
  - TODO: introduce proper migration scripts and disable automatic schema sync outside development.

- **Logging and monitoring**
  - There is minimal logging (mostly `console.error` in the frontend).
  - TODO: integrate structured logging on the backend and better error reporting in the client.

- **Testing**
  - NestJS includes spec files, but end‑to‑end scenarios for high concurrency and failure modes are limited.
  - TODO: extend automated tests to cover seat contention, edge status transitions, and user flows.

### 7.5 Handling heavy data & high traffic

- **Context**
  - As the concerts catalogue and reservation history grow into the thousands, naive list endpoints that always fetch “everything” will:
    - Return large JSON payloads.
    - Re‑execute identical, unindexed queries.
    - Increase CPU and I/O load on the database.
  - Under spikes of concurrent users (e.g., popular free concert campaigns), this can degrade latency and overall reliability.

- **Potential improvements**
  - **Pagination / lazy loading**
    - Introduce query parameters like `?page=1&pageSize=20` on `GET /concerts` and `GET /reservations`.
    - Update the frontend to fetch subsequent pages on scroll or via “Load more” buttons.
  - **Indexing**
    - Add DB indexes on high‑cardinality columns, e.g.:
      - `reservations.user_id`
      - `reservations.concert_id`
      - `reservations.status`
    - This keeps history lookups and admin reports fast even as data volume grows.
  - **Caching**
    - Cache hot reads (e.g., concerts list) in Redis or an in‑memory store with short TTLs.
    - Invalidate cache entries on mutations (`POST/PUT/DELETE /concerts`).
  - **Rendering & assets**
    - Use Next.js server‑side rendering (SSR) or static generation (SSG) for common views to shift work off clients.
    - Host static assets behind a CDN and enable HTTP compression to optimise bandwidth.

### 7.6 Preventing double bookings during ticket rushes

- **Context**
  - A free ticket release can trigger many simultaneous requests for the same concert.
  - Without extra safeguards, two users might both attempt to reserve the last seat at nearly the same time, or a single user might double‑click Reserve.

- **Current protections**
  - `ReservationsService.create` uses a database transaction to:
    - Check `available_seats`.
    - Enforce a unique reservation per (user, concert) pair.
    - Decrement `available_seats` atomically with reservation creation.
  - The frontend disables certain flows via UX (e.g., message “You already reserved a seat for this concert” when a reservation exists).

- **Further hardening options**
  - **Stronger DB locking**
    - Use pessimistic locking (`SELECT ... FOR UPDATE`) on the `concert` row during seat checks to strictly serialize seat updates.
    - Alternatively, use optimistic locking (version columns or updated_at checks) and retry on conflict.
  - **Rate limiting / idempotency**
    - Implement rate limits per user/IP for reservation attempts during a time window.
    - Make reservation calls idempotent by keying them on `(userId, concertId)` and short‑circuiting duplicates.
  - **Queue‑based processing**
    - For extreme spikes, enqueue reservation requests (e.g., Redis + BullMQ or similar) and process them in a single consumer to fully serialize seat decrements.
  - **Real‑time feedback**
    - Push seat availability updates via WebSockets or server‑sent events so clients see near‑real‑time sold‑out status.
    - Disable the Reserve button in the UI while a request is in flight to avoid rapid duplicate submissions.



