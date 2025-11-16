## 1. Overview (ภาพรวมระบบ)

**Free Concert Ticket System (Next.js + NestJS + Postgres)** คือแอปตัวอย่างแบบ full‑stack ที่ให้ผู้ใช้สมัครสมาชิก / ล็อกอิน และจองที่นั่งฟรีสำหรับคอนเสิร์ต ขณะที่ฝั่งแอดมินสามารถจัดการคอนเสิร์ตและดูประวัติการจองได้แบบรวมศูนย์

- **ฝั่ง User** สามารถ:
  - สมัครสมาชิก (Register) และล็อกอิน (Login)
  - ดูรายการ Concert ทั้งหมด พร้อมจำนวนที่นั่งทั้งหมดและที่เหลืออยู่แบบ real‑time (จากฐานข้อมูลจริง)
  - จองที่นั่ง (Reserve) หรือยกเลิกการจอง (Cancel) ได้ 1 ที่นั่งต่อ 1 Concert
- **ฝั่ง Admin** สามารถ:
  - สร้าง Concert ใหม่ และลบ Concert ได้
  - ดูสถิติภาพรวม เช่น จำนวนที่นั่งทั้งหมด จำนวนที่ถูกจอง และจำนวนที่ถูกยกเลิก
  - ดูประวัติการจองทั้งหมดในระบบ (Reservation History)

สถาปัตยกรรมระบบประกอบด้วย:

- **Next.js 16** (React 19) ฝั่ง Frontend อยู่ในโฟลเดอร์ `client` ใช้ Tailwind CSS ในการตกแต่ง UI
- **NestJS 11** ฝั่ง Backend อยู่ในโฟลเดอร์ `server` ให้บริการ REST API ภายใต้ prefix `/api`
- **TypeORM** เชื่อมต่อกับ **PostgreSQL 15** (ผ่าน Docker) ใช้เป็นฐานข้อมูลหลัก ทำให้สามารถจัดการ transaction เวลาแก้ไขจำนวนที่นั่งได้อย่างปลอดภัย

**การสื่อสารระหว่าง Frontend – Backend**

- ฝั่ง Next.js เรียก NestJS API ผ่าน `fetch` ไปยัง endpoint เช่น `/api/concerts`, `/api/reservations`, `/api/users`, `/api/users/login`
- ฝั่ง Backend ใช้ `ValidationPipe` และ `class-validator` ตรวจสอบ request, แปลง DTO เป็น Entity ของ TypeORM แล้วบันทึก/อ่านข้อมูลจาก Postgres
- การสร้าง Reservation และการเปลี่ยนสถานะจะถูกห่ออยู่ใน transaction (โดยเฉพาะตอน create) เพื่อให้ค่าของ `available_seats` ในตาราง `concerts` สอดคล้องกับ reservation จริง และช่วยลดปัญหาแข่งกันจอง (concurrency)

---

## 2. System Architecture / Flow (สถาปัตยกรรมและลำดับการทำงาน)

**ภาพรวมการไหลของ Request/Response**

- **Browser User** → **Next.js page (React component)** → `fetch("http://localhost:3001/api/...")` →
  **NestJS Controller** → **Service** → **TypeORM Repository** → **Postgres** → ส่ง JSON response กลับตามเส้นทางเดิม

**2.1 User journeys หลัก**

- **ดูรายการ Concert**
  - User (ล็อกอินแล้ว) → เปิดหน้า `UserHomePage` (`client/app/page.tsx`) →
    เรียก `fetch("${API_BASE_URL}/concerts")` →
    มาที่ `ConcertsController.findAll()` →
    เรียก `ConcertsService.findAll()` →
    ใช้ `Repository<Concert>.find()` อ่านจากตาราง `concerts` →
    ส่ง `Concert[]` กลับ → React แสดง card ของแต่ละ concert พร้อม `total_seats` และ `available_seats`

- **จองที่นั่ง (Reserve seat)**
  - User กดปุ่ม **Reserve** บน card ของ concert →
    เรียก `UserHomePage.reserveSeat(concertId)` →
    ส่ง `POST ${API_BASE_URL}/reservations` พร้อม body `{ userId, concertId }` →
    เข้าสู่ `ReservationsController.create()` →
    เรียก `ReservationsService.create()` →
    ภายใน `DataSource.transaction()`:
    - ดึง `User` และ `Concert` จากฐานข้อมูล
    - ตรวจสอบว่าผู้ใช้ยังไม่มี reservation สำหรับ concert นี้
    - ถ้า `concert.available_seats >= 1` สร้าง `Reservation` ใหม่ `status = "reserved"`
    - ลดค่า `concert.available_seats` ลง 1 แล้วบันทึก
    →
    commit transaction ลง Postgres →
    ส่ง response 201 กลับ →
    ฝั่ง client เรียก `refreshConcertsAndReservations()` เพื่อโหลดข้อมูลล่าสุดและ render ใหม่

- **ยกเลิกการจอง (Cancel reservation)**
  - User กดปุ่ม **Cancel** บน concert ที่ตัวเองจองไว้ →
    เรียก `UserHomePage.cancelReservation(concertId)` →
    หา reservation ที่ตรงกับ `(userId, concertId)` →
    ส่ง `PUT ${API_BASE_URL}/reservations/:id` พร้อม `{ status: "cancelled" }` →
    เข้าสู่ `ReservationsController.update()` →
    เรียก `ReservationsService.update()`:
    - ถ้า reservation ปัจจุบันมี `status = "reserved"` → เปลี่ยนเป็น `"cancelled"` และเพิ่ม `concert.available_seats` กลับ 1
    →
    บันทึกข้อมูลผ่าน repository → อัปเดตใน Postgres →
    ฝั่ง client โหลด concert/reservation ใหม่และอัปเดตหน้าจอ

- **Admin: สร้าง concert**
  - Admin เข้า `/admin` (`AdminHomePage`) →
    กรอกฟอร์มแล้วกด submit →
    ส่ง `POST ${API_BASE_URL}/concerts` พร้อม `{ name, description, totalSeats }` →
    `ConcertsController.create()` →
    `ConcertsService.create()`:
    - สร้าง `Concert` ใหม่ โดยตั้ง `total_seats = totalSeats` และ `available_seats = totalSeats`
    - บันทึกลงตาราง `concerts`
    →
    client โหลดรายการ concert ใหม่และอัปเดตสถิติบน dashboard

- **Admin: ลบ concert**
  - Admin กดปุ่ม **Delete** บน concert → เปิด `ConfirmModal` →
    เมื่อยืนยัน:
    - ส่ง `DELETE ${API_BASE_URL}/concerts/:id` →
      `ConcertsController.remove()` →
      `ConcertsService.remove()`:
      - ดึง concert ถ้าไม่เจอจะตอบ 404
      - `Repository.remove()` ลบ concert ออกจากฐานข้อมูล (reservation ที่เกี่ยวข้องจะถูกลบตามด้วย `onDelete: 'CASCADE'`)

- **Admin: ดูประวัติการจอง (Reservation history)**
  - Admin เข้า `/admin/history` (`AdminHistoryPage`) →
    เรียก `fetch("${API_BASE_URL}/reservations")` →
    `ReservationsController.findAll()` →
    `ReservationsService.findAll()` →
    อ่านจากตาราง `reservations` พร้อม `relations: ['concert', 'user']` →
    ส่ง JSON กลับ →
    แสดงผลในตาราง (เวลา, ชื่อผู้ใช้, ชื่อ concert, action Reserve/Cancel)

**2.2 ตัวอย่าง flow แบบย่อ**

- **View concerts**

  - User → Next.js `UserHomePage` → `fetch("/api/concerts")` →
    `ConcertsController.findAll` → `ConcertsService.findAll` →
    `ConcertsRepository.find` → Postgres `concerts` → response

- **Reserve seat**

  - User → `UserHomePage.reserveSeat` → `POST /api/reservations` →
    `ReservationsController.create` → `ReservationsService.create` (transaction) →
    `ReservationsRepository` + `ConcertsRepository` → Postgres (`reservations`, `concerts`) → response

- **Cancel reservation**

  - User → `UserHomePage.cancelReservation` → `PUT /api/reservations/:id` →
    `ReservationsController.update` → `ReservationsService.update` →
    `ReservationsRepository` + `ConcertsRepository` → Postgres → response

- **Admin manage concerts**

  - Admin → `AdminHomePage` (Overview / Create) →
    `fetch("/api/concerts")`, `POST /api/concerts`, `DELETE /api/concerts/:id` →
    `ConcertsController` → `ConcertsService` → `ConcertsRepository` → Postgres

---

## 3. Tech Stack (เทคโนโลยีที่ใช้)

**Backend**

- **NestJS 11** (`@nestjs/common`, `@nestjs/core`) สำหรับโครงสร้าง API แบบ modular
- **@nestjs/typeorm** และ **TypeORM** สำหรับเชื่อมต่อฐานข้อมูลและจัดการ transaction
- **PostgreSQL 15** (ผ่าน Docker image `postgres:15` ใน `docker-compose.yml`)
- **class-validator** + **class-transformer** ใช้คู่กับ `ValidationPipe` ระดับ global

**Frontend**

- **Next.js 16** (`client` app) ทำงานด้วย **React 19**
- **Tailwind CSS 4** สำหรับจัด layout / style UI
- **lucide-react** สำหรับ icon ต่าง ๆ ในหน้า UI

**Infrastructure / tooling**

- **Docker Compose** สำหรับรัน Postgres ในเครื่องนักพัฒนา
- **TypeScript 5** ทั้งฝั่ง client และ server
- **ESLint** และ **Prettier** สำหรับ lint/format โค้ด

**3.1 ตารางสรุป Libraries**

| Library             | Purpose (หน้าที่)                                      | Example usage (ตัวอย่างการใช้)                                               |
|---------------------|--------------------------------------------------------|-------------------------------------------------------------------------------|
| **Next.js**         | Framework สำหรับสร้าง React app ฝั่ง frontend         | Page ใน `client/app` เช่น `page.tsx`, `admin/page.tsx`                       |
| **React**           | Component model และการจัดการ state                     | ใช้ hooks เช่น `useState`, `useEffect` ใน component                          |
| **NestJS**          | Backend framework แบบมี module/controller ชัดเจน       | Module เช่น `ConcertsModule`, `ReservationsModule`, `UsersModule`           |
| **TypeORM**         | ORM สำหรับ Postgres ใช้ entity/repository/transaction  | Entity: `Concert`, `User`, `Reservation`; ใช้ `DataSource.transaction()`     |
| **PostgreSQL**      | Relational database หลักของระบบ                        | ฐานข้อมูล `concert_app` มีตาราง `concerts`, `users`, `reservations`        |
| **Docker**          | รัน Postgres แบบ container ใน local                    | ไฟล์ `docker-compose.yml` ที่กำหนด service `postgres:15`                    |
| **class-validator** | ตรวจสอบความถูกต้องของ DTO                             | ใช้ใน `CreateConcertDto`, `CreateReservationDto`, `CreateUserDto`           |
| **Tailwind CSS**    | Utility‑first CSS สำหรับสไตล์ UI                       | class เช่น `rounded-lg`, `bg-sky-600`, `text-zinc-700`                       |
| **lucide-react**    | Icon library สำหรับ React                              | icon เช่น `<House />`, `<LogOut />`, `<User />` ใน sidebar และ card         |

### 3.2 TypeORM ในโปรเจกต์นี้

- **Configuration**
  - ตั้งค่าใน `AppModule` ผ่าน `TypeOrmModule.forRoot({...})` โดยกำหนด:
    - `type: 'postgres'`, `host: 'localhost'`, `port: 5432`
    - `username: 'postgres'`, `password: 'password'`, `database: 'concert_app'`
    - `synchronize: true` (ให้ TypeORM สร้าง/อัปเดต schema อัตโนมัติในช่วงพัฒนา)
    - `autoLoadEntities: true` (ดึง entity จากทุก module ที่ import มาให้อัตโนมัติ)
  - แต่ละ feature module (เช่น concerts, reservations, users) เรียก `TypeOrmModule.forFeature([EntityClass])` เพื่อให้ service สามารถ inject repository ของ entity นั้น ๆ ได้

- **Entities และ repositories**
  - `Concert`, `User`, `Reservation` เป็น TypeScript class ธรรมดาที่คั่นด้วย decorator อย่าง `@Entity()`, `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, `@OneToMany` เป็นต้น
  - ใน service จะ inject repository ด้วย `@InjectRepository(Entity)` แล้วใช้สำหรับ:
    - CRUD (`find`, `findOne`, `save`, `remove`)
    - load ความสัมพันธ์ เช่น `relations: ['concert', 'user']` เวลาดึง reservation

- **Transactions**
  - การทำงานบางส่วน (เช่น `ReservationsService.create`) ใช้ `DataSource.transaction` เพื่อ:
    - หา user และ concert ใน snapshot เดียวกัน
    - ตรวจสอบว่าไม่มี reservation เดิมของ user/concert คู่นี้
    - ตรวจสอบ `available_seats`
    - สร้าง reservation ใหม่และอัปเดต `available_seats` ของ concert พร้อมกัน
  - ทำให้ได้คุณสมบัติ **atomicity**: ทุกขั้นตอนสำเร็จหรือ rollback ทั้งชุด ซึ่งสำคัญมากสำหรับ logic นับจำนวนที่นั่งภายใต้โหลดแบบ concurrent

- **QueryBuilder**
  - `UsersService.authenticate` ใช้ `createQueryBuilder` เพื่อดึง column `password` ซึ่งปกติจะไม่ถูก select (`select: false`) โดยเรียก `.addSelect('user.password')`

### 3.3 Docker และ lifecycle ของฐานข้อมูล

- **Postgres ผ่าน Docker Compose**
  - ไฟล์ `docker-compose.yml` กำหนด service `postgres` ไว้ดังนี้:
    - image: `postgres:15`
    - environment:
      - `POSTGRES_USER=postgres`
      - `POSTGRES_PASSWORD=password`
      - `POSTGRES_DB=concert_app`
    - port mapping: `5432:5432`
    - volume ชื่อ `pgdata` สำหรับเก็บ data ให้คงอยู่ระหว่างการ restart container
  - ค่าเหล่านี้ตรงกับ configuration ของ TypeORM ใน `AppModule` ทำให้เมื่อรัน `docker compose up -d` ระบบจะมี Postgres พร้อมใช้ให้ NestJS เชื่อมต่อทันที

- **Flow การพัฒนาใน local**
  - Start database: รัน `docker compose up -d` ที่ root ของโปรเจกต์
  - Start backend: `cd server && npm run start:dev` (NestJS จะเชื่อมต่อไปยัง Postgres ใน Docker)
  - Start frontend: `cd client && npm run dev` (Next.js ใช้ `API_BASE_URL` ชี้ไปที่ NestJS)

- **Lifecycle และการ reset ข้อมูล**
  - volume `pgdata` ทำให้ข้อมูลไม่หายเมื่อ restart container
  - ถ้าต้องการเริ่ม schema ใหม่ในช่วง dev สามารถลบ volume (`docker volume rm concert-app_pgdata`) แล้ว start stack ใหม่ ให้ TypeORM สร้างตารางใหม่ด้วย `synchronize: true`

### 3.4 Testing และ unit tests

- **Testing stack**
  - ฝั่ง backend ใช้ **Jest** ตามที่กำหนดใน `server/package.json` และ config `jest` ภายใน:
    - test เป็นไฟล์ TypeScript ที่ลงท้ายด้วย `*.spec.ts` ในโฟลเดอร์ `src`
    - ใช้ `ts-jest` แปลง TypeScript ระหว่างรันทดสอบ
    - test environment เป็น Node และเก็บ coverage ไว้ในโฟลเดอร์ `coverage/`
  - script หลัก ๆ:
    - `npm test` — รัน Jest ทั้งชุด
    - `npm run test:watch` — โหมด watch สำหรับพัฒนา
    - `npm run test:cov` — รัน test พร้อมเก็บ coverage

- **Spec files ที่มีอยู่แล้ว**
  - `app.controller.spec.ts` — ทดสอบ controller หลักของแอป (health/greeting เป็นต้น)
  - `concerts.controller.spec.ts`, `concerts.service.spec.ts` — ทดสอบ behaviour ของ concert controller/service
  - `reservations.controller.spec.ts`, `reservations.service.spec.ts` — ทดสอบ flow การจอง (reservation)
  - `users.controller.spec.ts`, `users.service.spec.ts` — ทดสอบ CRUD ของ user และการ authenticate

- **สิ่งที่มักทดสอบ**
  - Controller:
    - status code และรูปแบบ response เมื่อสำเร็จ/ล้มเหลว
    - ตรวจว่ามีการ delegate ไปยัง service ที่ถูกต้อง
  - Service:
    - business rule เช่น:
      - ป้องกันการจองเกิน (`available_seats < 1`)
      - ป้องกันการจองซ้ำต่อ user/concert เดียวกัน
      - การเพิ่ม/ลดจำนวนที่นั่งเมื่อ cancel หรือ delete
    - เส้นทาง error (เช่น `NotFoundException`, `BadRequestException`, `UnauthorizedException`)

- **แนวทางขยาย test ให้ลึกขึ้น**
  - เขียน test จำลองกรณีจองพร้อมกัน (concurrent reservations) โดยใช้ mock repository หรือ in‑memory database เพื่อตรวจ logic transaction
  - เพิ่ม integration test (e2e) ที่ใช้ Supertest ยิง request เข้า NestJS app จริง ๆ ร่วมกับฐานข้อมูลสำหรับทดสอบ
  - ขยาย coverage ครอบคลุม edge case ในหัวข้อที่ 7 (เช่น pagination, hardening ด้าน security เป็นต้น)

---

## 4. Core Features (ฟีเจอร์หลักของระบบ)

### 4.1 Concert CRUD

**Entity**

- `Concert` (`server/src/concerts/entities/concert.entity.ts`):
  - `id: number`
  - `name: string`
  - `description: string`
  - `total_seats: number`
  - `available_seats: number`
  - ความสัมพันธ์แบบ one‑to‑many กับ `Reservation[]`

**DTOs**

- `CreateConcertDto`
  - `name: string` (ต้องมี, ไม่เป็นค่าว่าง)
  - `description: string` (ต้องมี, ไม่เป็นค่าว่าง)
  - `totalSeats: number` (ต้องเป็นจำนวนเต็มบวก)
- `UpdateConcertDto` (partial)
  - อาจส่ง `name`, `description`, หรือ `totalSeats` บางส่วนก็ได้ (มี validation เป็นจำนวนเต็มบวก)

**พฤติกรรมของ service**

- **Create concert**

  ```ts
  async create(dto: CreateConcertDto) {
    const concert = concertsRepository.create({
      name: dto.name,
      description: dto.description,
      total_seats: dto.totalSeats,
      available_seats: dto.totalSeats, // เริ่มต้นให้จำนวนที่นั่งว่างเท่ากับจำนวนที่นั่งทั้งหมด
    });
    return concertsRepository.save(concert);
  }
  ```

- **Find all / find one**

  - `findAll()` คืน concert ทั้งหมดเรียงตาม `id ASC`
  - `findOne(id)` ถ้าไม่พบ concert จะ `throw NotFoundException`

- **Update concert**

  - อัปเดตได้ทั้ง `name`, `description`, และ `totalSeats`
  - ก่อนลดจำนวน `totalSeats` ระบบจะคำนวณจำนวนที่ถูกจองไปแล้ว  
    \(`reservedSeats = total_seats - available_seats`\)
  - ถ้า `dto.totalSeats < reservedSeats` จะ `throw BadRequestException` เพื่อป้องกันจำนวนที่นั่งรวม น้อยกว่าจำนวนที่ถูกจองแล้ว

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

- **Delete concert**

  - `remove(id)`:
    - เรียก `findOne(id)` ถ้าไม่พบจะตอบ 404
    - เรียก `concertsRepository.remove(concert)` เพื่อลบแถวในตาราง `concerts`
    - reservation ที่เกี่ยวข้องจะถูกลบตาม (ผ่านความสัมพันธ์ `ManyToOne` และ `onDelete: 'CASCADE'` ใน entity `Reservation`)

### 4.2 Reservation system และ seat decrement logic

**Entity**

- `Reservation` (`server/src/reservations/entities/reservation.entity.ts`):
  - `id: number`
  - `user: User` (many‑to‑one, ลบ user แล้ว reservation ถูกลบตาม)
  - `concert: Concert` (many‑to‑one, ลบ concert แล้ว reservation ถูกลบตาม)
  - `status: 'reserved' | 'cancelled'` (ค่าเริ่มต้น `'reserved'`)
  - `created_at: Date` (เวลาสร้างอัตโนมัติ)

**DTOs**

- `CreateReservationDto`
  - `userId: number` (จำนวนเต็มบวก)
  - `concertId: number` (จำนวนเต็มบวก)
- `UpdateReservationDto`
  - `status: 'reserved' | 'cancelled'`

**สร้าง reservation (logic หลัก)**

- อยู่ใน `ReservationsService.create()` ใช้ `DataSource.transaction` เพื่อห่อทุกขั้นตอนใน transaction เดียว

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

**Update สถานะ reservation**

- อยู่ใน `ReservationsService.update(id, dto)`:

  - ถ้า `dto.status` เหมือนสถานะปัจจุบัน จะคืนค่า reservation เดิมเลย
  - เปลี่ยนจาก `"reserved"` → `"cancelled"`:
    - ตั้ง `reservation.status = 'cancelled'`
    - เพิ่มค่า `reservation.concert.available_seats` ขึ้น 1
    - บันทึกทั้ง concert และ reservation
  - เปลี่ยนจาก `"cancelled"` → `"reserved"`:
    - ตรวจสอบ `available_seats` ถ้าน้อยกว่า 1 → `throw BadRequestException('No seats available to reinstate the reservation')`
    - ลด `available_seats` ลง 1 และตั้ง `status = 'reserved'`
    - บันทึกทั้ง concert และ reservation
  - กรณีอื่น ๆ ที่ไม่รองรับ → `throw BadRequestException('Unsupported reservation status transition')`

**Delete reservation**

- `ReservationsService.remove(id)`:
  - ดึง reservation ผ่าน `findOne(id)`
  - ถ้า reservation ยังมี `status = 'reserved'` จะเพิ่ม `concert.available_seats` กลับ 1 ก่อนลบ
  - บันทึก concert แล้วค่อยลบ reservation

### 4.3 User module

**Entity**

- `User` (`server/src/users/entities/user.entity.ts`):
  - `id: number`
  - `name: string`
  - `email: string` (unique)
  - `password: string` (ไม่ถูก select โดย default: `select: false`)
  - `role: 'admin' | 'user'` (simple enum, ค่าเริ่มต้น `'user'`)
  - ความสัมพันธ์แบบ one‑to‑many กับ `Reservation[]`

**DTOs**

- `CreateUserDto`: `name`, `email`, `password` (อย่างน้อย 6 ตัวอักษร), `role` (ไม่บังคับ)
- `UpdateUserDto`: ทุก field เป็น optional แต่มี validation
- `LoginUserDto`: `email`, `password`

**พฤติกรรมของ service**

- **Create user**
  - `UsersService.create(dto)`:
    - สร้าง entity `User` จาก DTO (demo นี้ยังไม่ได้ hash password)
    - บันทึกลงฐานข้อมูล
    - คืนค่าเป็น `SafeUser` (object ที่ไม่มี `password`) ผ่านฟังก์ชัน `sanitizeUser()`

- **Find users**
  - `findAll()` และ `findOne(id)` คืนค่าเฉพาะ `SafeUser` (ไม่มี password)

- **Update / delete user**
  - `update(id, dto)` อัปเดตเฉพาะ field ที่ส่งมา และคืนค่า `SafeUser` ที่อัปเดตแล้ว
  - `remove(id)` ลบ user ถ้าไม่เจอจะ `throw NotFoundException` และเมื่อถูกลบ reservation ที่เกี่ยวข้องจะถูกลบด้วย

- **Authenticate (login)**

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

- ฝั่ง frontend จะเก็บข้อมูล `SafeUser` ที่ได้จาก login ลงใน `localStorage` ภายใต้ key `authUser`
- ระบบยัง **ไม่ได้ใช้ JWT หรือ session** เป็นเพียงการจำสถานะ login ที่ฝั่ง browser เท่านั้น

- **ดึง reservation history ของ user**
  - `UsersService.getReservationHistory(id)`:
    - ตรวจสอบก่อนว่า user มีอยู่จริง
    - จากนั้น query `Reservation` ด้วย `where: { user: { id } }` และโหลด `concert`, `user` มาด้วย พร้อมจัดเรียงตาม `created_at DESC`

### 4.4 Concurrency handling (การจัดการหลายคนจองพร้อมกัน)

**ตอนสร้าง reservation**

- `ReservationsService.create()` ทำงานภายใน `dataSource.transaction(...)`
- ข้อดีของ transaction นี้:
  - ตรวจสอบ existing reservation
  - ตรวจสอบจำนวนที่นั่งว่าง (`concert.available_seats`)
  - สร้าง reservation และลด `available_seats`
  - ทั้งหมดสำเร็จหรือพังพร้อมกัน (atomic)

**ตอน update status / delete**

- แม้ `update` และ `remove` จะไม่ได้ห่อใน transaction แยก แต่ในแต่ละคำขอจะทำตามลำดับ:
  - โหลด reservation + concert
  - ปรับค่า `available_seats` ตาม logic
  - บันทึกทั้งสอง entity
- โดยอาศัยการ lock ระดับแถวของ Postgres ทำให้กรณีใช้งานทั่วไปทำงานได้ถูกต้อง  
  ถ้าโหลดสูงมาก ๆ อาจต้องปรับปรุงเพิ่มเติม (กล่าวต่อในหัวข้อ Edge cases)

**พฤติกรรมฝั่ง frontend**

- client จะไม่เปลี่ยนค่า `available_seats` เอง
- หลังจาก reserve/cancel สำเร็จ จะเรียก `refreshConcertsAndReservations()` เพื่อดึงข้อมูลใหม่จาก backend เสมอ ทำให้ UI แสดงจำนวนที่นั่งตรงกับฐานข้อมูล

---

## 5. Data Model / ER Diagram (โครงสร้างข้อมูลและความสัมพันธ์)

มุมมองเชิง ER diagram โดยย่อคือ:

- `User` 1‑* `Reservation` *‑1 `Concert`

### 5.1 ตาราง `users`

- **Columns**
  - `id` (primary key, `serial`)
  - `name` (`varchar`, not null)
  - `email` (`varchar`, unique, not null)
  - `password` (`varchar`, not null, ไม่ถูก select โดย default)
  - `role` (`enum`, `'admin' | 'user'`, ค่าเริ่มต้น `'user'`)

- **Relationships**
  - ความสัมพันธ์แบบ one‑to‑many กับ `reservations.user` (FK ชี้จาก `Reservation.user` → `users.id`)
  - เมื่อ user ถูกลบ reservation ที่เกี่ยวข้องจะถูกลบตาม (`onDelete: 'CASCADE'`)

### 5.2 ตาราง `concerts`

- **Columns**
  - `id` (primary key, `serial`)
  - `name` (`varchar`, not null)
  - `description` (`varchar`, not null)
  - `total_seats` (`int`, not null)
  - `available_seats` (`int`, not null)

- **Relationships**
  - ความสัมพันธ์แบบ one‑to‑many กับ `reservations.concert` (FK ชี้จาก `Reservation.concert` → `concerts.id`)
  - เมื่อ concert ถูกลบ reservation ที่เกี่ยวข้องจะถูกลบตาม (`onDelete: 'CASCADE'`)

### 5.3 ตาราง `reservations`

- **Columns**
  - `id` (primary key, `serial`)
  - `userId` (foreign key → `users.id`)
  - `concertId` (foreign key → `concerts.id`)
  - `status` (`varchar`, `'reserved' | 'cancelled'`, ค่าเริ่มต้น `'reserved'`)
  - `created_at` (`timestamp`, กำหนดอัตโนมัติ)

- **Relationships**
  - many‑to‑one กับ `users` (reservation แต่ละรายการมีเจ้าของเป็น user เดียว)
  - many‑to‑one กับ `concerts` (reservation แต่ละรายการผูกกับ concert เดียว)
  - ทั้งสอง FK ใช้ `onDelete: 'CASCADE'` ทำให้เวลา user หรือ concert ถูกลบ reservation ที่เกี่ยวข้องจะถูกลบไปด้วย

---

## 6. API Endpoints (จุดเชื่อมต่อ API)

ทุก endpoint ของ NestJS อยู่ภายใต้ prefix `/api` ตามที่ตั้งค่าใน `main.ts`:

- Base URL ฝั่ง backend: `http://localhost:3001/api`

### 6.1 Concerts

**Base path**: `/concerts`

- **POST `/concerts`** — สร้าง concert ใหม่

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
    - 400 ถ้า validation ไม่ผ่าน (`name`, `description`, `totalSeats` ไม่ครบหรือรูปแบบไม่ถูกต้อง)

- **GET `/concerts`** — ดึง concert ทั้งหมด

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

- **GET `/concerts/:id`** — ดึงรายละเอียด concert ตาม id

  - **Params**
    - `id` — path parameter เป็นจำนวนเต็ม
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
    - 404 ถ้าไม่พบ concert

- **PUT `/concerts/:id`** — แก้ไข concert

  - **Request body (ส่งบาง field ก็ได้)**

    ```json
    {
      "name": "Rock Night (Updated)",
      "description": "Updated description.",
      "totalSeats": 120
    }
    ```

  - **พฤติกรรม**
    - คำนวณ `available_seats` ใหม่โดยไม่ทำให้จำนวนที่จองไปแล้วหาย
    - ถ้า `totalSeats` ใหม่ น้อยกว่าจำนวนที่จองไปแล้ว → ตอบ 400

- **DELETE `/concerts/:id`** — ลบ concert

  - ลบ concert และ reservation ที่ผูกกับ concert นั้นทั้งหมด
  - response มักจะเป็น 200/204 (ไม่มี body) ฝั่ง frontend เช็คแค่ `response.ok`

### 6.2 Reservations

**Base path**: `/reservations`

- **POST `/reservations`** — สร้าง reservation

  - **Request body**

    ```json
    {
      "userId": 3,
      "concertId": 1
    }
    ```

  - **พฤติกรรม**
    - ภายใน transaction:
      - ตรวจสอบว่ามี user และ concert จริง
      - ตรวจสอบว่า user ยังไม่มี reservation สำหรับ concert นี้
      - ตรวจสอบว่า `available_seats > 0`
      - สร้าง `Reservation` `status = "reserved"` และลด `available_seats` ลง

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
    - 404 ถ้าไม่พบ user หรือ concert
    - 400 ถ้า:
      - user เคยจอง concert นี้แล้ว
      - ไม่มีที่นั่งเหลือ (`available_seats` = 0)

- **GET `/reservations`** — ดึง reservation ทั้งหมด

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

- **GET `/reservations/:id`** — ดึง reservation ตาม id

  - ถ้าไม่เจอจะได้ 404

- **GET `/reservations/user/:userId`** — ดึง reservation ของ user คนเดียว

  - คืน reservation ที่ `user.id = userId` เรียงตาม `created_at DESC`

- **PUT `/reservations/:id`** — เปลี่ยนสถานะ reservation

  - **Request body**

    ```json
    { "status": "cancelled" }
    ```

    หรือ

    ```json
    { "status": "reserved" }
    ```

  - **พฤติกรรม**
    - `"reserved"` → `"cancelled"`:
      - เปลี่ยนสถานะเป็น `cancelled` และเพิ่ม `concert.available_seats` 1
    - `"cancelled"` → `"reserved"`:
      - ถ้า `available_seats > 0` ลดลง 1 และตั้งสถานะเป็น `reserved`
    - transition อื่น ๆ → ตอบ 400

- **DELETE `/reservations/:id`** — ลบ reservation

  - ถ้า reservation นั้นยังเป็น `"reserved"` จะเพิ่ม `available_seats` กลับ 1 ก่อนลบ

### 6.3 Users

**Base path**: `/users`

- **POST `/users`** — สมัครสมาชิก (register)

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

  - ระบบจะ **ไม่** ส่ง `password` กลับมาใน response

- **GET `/users`** — ดึง user ทั้งหมด

  - คืนข้อมูลแบบ sanitized (ไม่มี password)

- **GET `/users/:id`** — ดึง user ตาม id

  - ถ้าไม่เจอจะตอบ 404

- **PUT `/users/:id`** — แก้ไขข้อมูล user

  - รองรับการแก้ไข `name`, `email`, `password`, `role` แบบ partial

- **DELETE `/users/:id`** — ลบ user

  - reservation ทั้งหมดที่เป็นของ user นี้จะถูกลบด้วย (ผ่าน `onDelete: 'CASCADE'`)

- **POST `/users/login`** — ล็อกอิน

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
    - 401 ถ้า email หรือ password ไม่ถูกต้อง (`UnauthorizedException`)

- **GET `/users/:id/reservations`** — ดึง reservation history ของ user

  - คืน reservation พร้อมข้อมูล `user` และ `concert`
  - ปัจจุบันฝั่ง admin UI ใช้ `/reservations` ตรง ๆ มากกว่า endpoint นี้

---

## 7. Edge Cases, Limitations, TODO (กรณีพิเศษ ข้อจำกัด และงานที่ควรทำต่อ)

### 7.1 Concurrency และ race conditions

- Flow การจองหลักใช้ transaction และ logic ปรับจำนวนที่นั่งใน service (อ้างอิงจากหัวข้อ 4.4) เพื่อให้ค่า `available_seats` สอดคล้องกับ reservation จริง และลดโอกาส oversell
- หัวข้อ 7.6 จะขยายแนวทางเพิ่มเติมสำหรับรองรับกรณี traffic สูงและการแข่งกันจอง เช่น locking, queue, rate limiting และ real‑time update

### 7.2 Security limitations (ข้อจำกัดด้านความปลอดภัย)

- **ยังไม่มี authentication/authorization แบบจริงจัง**
  - password ถูกเก็บแบบ plain text (ยังไม่ทำ hashing)
  - ไม่มี JWT หรือ session ฝั่ง backend; client แค่เก็บ `SafeUser` ใน `localStorage` แล้วใช้เช็ค role
  - controller ของ NestJS ยังไม่ได้ป้องกันสิทธิ์ด้วย guard ใด ๆ ใครรู้ URL ก็เรียก endpoint admin ได้
  - **ผลกระทบ**: ถ้าใช้จริงใน production ควรเพิ่มอย่างน้อย:
    - การ hash password (เช่น ใช้ bcrypt)
    - auth guard/strategy (JWT หรือ session‑based)
    - role‑based access control (RBAC) สำหรับ route ระดับ admin

### 7.3 Validation และ UX limitations

- **ยังไม่มี pagination**
  - `GET /concerts` และ `GET /reservations` จะดึงข้อมูลทั้งหมด
  - ถ้าข้อมูลเยอะมากอาจมีผลต่อ performance และ UX → ควรพิจารณาเพิ่ม pagination หรือ infinite scroll

- **Validation เชิง business rule ยังน้อย**
  - DTO ตรวจแค่ประเภทและช่วงของค่า (เช่น เป็น number, ไม่เป็นค่าว่าง)
  - แต่ rule ที่ซับซ้อน เช่น จำกัดจำนวนการจองต่อวัน ยังไม่ได้ใส่

- **Error messaging**
  - ฝั่ง frontend ใช้ `extractErrorMessage` อ่าน message จาก response แล้วแสดงผ่าน snackbar
  - บางกรณีจะ fallback เป็นข้อความ error กลาง ๆ; ยังไม่มี i18n หรือ error code ที่ละเอียดมาก

### 7.4 Operational limitations / TODOs

- **Environment configuration**
  - การเชื่อมต่อ database เขียนค่าแบบ hard‑code ใน `AppModule` (host, port, username, password, database)
  - TODO: ย้ายค่าเหล่านี้ไปอยู่ใน environment variables เพื่อรองรับหลายสภาพแวดล้อม (dev/staging/prod)

- **Migrations**
  - ปัจจุบันใช้ `synchronize: true` ใน TypeORM ซึ่งเหมาะกับ dev แต่ไม่เหมาะกับ production
  - TODO: เพิ่มชุด migration อย่างเป็นทางการ และปิด `synchronize` ในสภาพแวดล้อม production

- **Logging และ monitoring**
  - ฝั่ง backend ยังมี logging น้อย ส่วนใหญ่ใช้ `console.error` ขณะที่ frontend ใช้ snackbar แสดง error
  - TODO: เพิ่มระบบ logging แบบ structured และระบบ monitoring/alerting

- **Testing**
  - มีไฟล์ spec ของ NestJS บางส่วน แต่ยังไม่ครอบคลุมกรณี end‑to‑end โดยเฉพาะเรื่อง concurrency และ error flow
  - TODO: เขียน test เพิ่มสำหรับเคสแข่งกันจองที่นั่ง, การเปลี่ยนสถานะแปลก ๆ และ user flow หลักทั้งฝั่ง user/admin

### 7.5 การรองรับข้อมูลจำนวนมากและ traffic สูง

- **บริบท**
  - เมื่อจำนวน concert และ reservation history เพิ่มเป็นหลักหลายพัน/หมื่น แค่การดึงข้อมูล “ทั้งหมด” ทุกครั้งจะทำให้:
    - payload ของ JSON ใหญ่ขึ้นเรื่อย ๆ
    - query ซ้ำ ๆ ที่ไม่ได้ index ทำงานช้าลง
    - database ใช้ CPU และ I/O สูง
  - ถ้ามีผู้ใช้จำนวนมากเข้าใช้งานพร้อมกัน (เช่น วันปล่อยบัตรฟรี) จะเริ่มเห็น latency สูงและระบบตอบสนองช้าลง

- **แนวทางปรับปรุง**
  - **Pagination / lazy loading**
    - เพิ่ม parameter เช่น `?page=1&pageSize=20` บน `GET /concerts` และ `GET /reservations`
    - ปรับฝั่ง frontend ให้โหลดข้อมูลทีละหน้า (load more / infinite scroll) แทนการดึงทั้งหมดทีเดียว
  - **Indexing**
    - เพิ่ม index บน column ที่ query บ่อย เช่น:
      - `reservations.user_id`
      - `reservations.concert_id`
      - `reservations.status`
    - ทำให้การค้นหาประวัติการจองและรายงานของ admin ทำงานเร็วแม้ข้อมูลเยอะ
  - **Caching**
    - cache endpoint ที่อ่านบ่อย (เช่น รายการ concerts) ใน Redis หรือ in‑memory store พร้อม TTL สั้น ๆ
    - invalidate cache เมื่อมีการเปลี่ยนข้อมูล เช่น `POST/PUT/DELETE /concerts`
  - **Rendering & assets**
    - ใช้ความสามารถ SSR/SSG ของ Next.js สร้างหน้า server‑side เพื่อลดงานฝั่ง browser
    - เสิร์ฟ static asset ผ่าน CDN และเปิดใช้ HTTP compression เพื่อลด bandwidth

### 7.6 ป้องกันการจองซ้ำในช่วงที่คนจองพร้อมกัน (ticket rush)

- **บริบท**
  - ช่วงปล่อยบัตรฟรี มักมี request พร้อมกันจำนวนมากเข้ามายังคอนเสิร์ตเดียวกัน
  - ถ้าไม่มีมาตรการเพิ่ม อาจเกิดกรณี:
    - มีหลายคนจอง “ที่นั่งสุดท้าย” ในเวลาไล่เลี่ยกัน
    - ผู้ใช้คนเดิมเผลอกด Reserve ซ้ำหลายครั้ง

- **สิ่งที่ระบบมีอยู่แล้ว**
  - `ReservationsService.create` ใช้ transaction กับฐานข้อมูลเพื่อตรวจสอบ:
    - ค่า `available_seats` ก่อนจอง
    - การมี reservation ซ้ำของคู่ `(user, concert)`
    - การลด `available_seats` ควบคู่กับการสร้าง reservation ให้เป็น atomic
  - ฝั่ง frontend ป้องกันระดับ UX เช่น แสดงข้อความ “You already reserved a seat for this concert” เมื่อ user เคยจอง concert นั้นแล้ว

- **แนวทางเสริมความแข็งแรงเพิ่มเติม**
  - **DB locking ที่เข้มขึ้น**
    - ใช้ pessimistic locking (`SELECT ... FOR UPDATE`) บนแถวของ concert ตอนตรวจจำนวนที่นั่ง เพื่อ serialize การลด/เพิ่มที่นั่งอย่างเคร่งครัด
    - หรือใช้ optimistic locking (version column / updated_at) แล้ว retry เมื่อเกิด conflict
  - **Rate limiting / idempotency**
    - จำกัดอัตราการยิง request จองต่อ user/IP ในช่วงเวลาหนึ่ง
    - ทำให้การเรียกจองเป็น idempotent โดยใช้ key `(userId, concertId)` แล้ว short‑circuit request ซ้ำ
  - **Queue‑based processing**
    - ในกรณี traffic สูงมาก ๆ สามารถใช้ queue (เช่น Redis + BullMQ หรือเทียบเท่า) เพื่อจัดคิวคำขอจองให้ worker ตัวเดียวเป็นคนปรับจำนวนที่นั่งทีละคำขอ
  - **Real‑time feedback**
    - push สถานะที่นั่งผ่าน WebSocket หรือ server‑sent events ให้ UI เห็นการเปลี่ยนแปลงแบบใกล้ real‑time
    - disable ปุ่ม Reserve ขณะที่ request กำลังส่งอยู่ เพื่อลดโอกาสกดซ้ำรัว ๆ


