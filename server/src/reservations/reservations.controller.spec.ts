import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { Reservation } from './entities/reservation.entity';
import { Concert } from '../concerts/entities/concert.entity';
import { User } from '../users/entities/user.entity';

describe('ReservationsController', () => {
  let controller: ReservationsController;
  let service: jest.Mocked<ReservationsService>;

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'User One',
    email: 'user@example.com',
    password: 'secret',
    role: 'user',
    reservations: [],
    ...overrides,
  });

  const createMockConcert = (overrides: Partial<Concert> = {}): Concert => ({
    id: 2,
    name: 'Concert',
    description: 'Description',
    total_seats: 100,
    available_seats: 80,
    reservations: [],
    ...overrides,
  });

  const createMockReservation = (overrides: Partial<Reservation> = {}): Reservation => ({
    id: 10,
    user: createMockUser(),
    concert: createMockConcert(),
    status: 'reserved',
    created_at: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const serviceValue = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByUser: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } satisfies Partial<jest.Mocked<ReservationsService>>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        {
          provide: ReservationsService,
          useValue: serviceValue,
        },
      ],
    }).compile();

    controller = module.get<ReservationsController>(ReservationsController);
    service = module.get<ReservationsService>(ReservationsService) as jest.Mocked<ReservationsService>;
  });

  it('should create a reservation', async () => {
    const dto: CreateReservationDto = { userId: 1, concertId: 2 };
    const reservation = createMockReservation();
    service.create.mockResolvedValue(reservation);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(reservation);
  });

  it('should return all reservations', async () => {
    const reservations = [createMockReservation({ id: 1 })];
    service.findAll.mockResolvedValue(reservations);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual(reservations);
  });

  it('should return reservations by user', async () => {
    const reservations = [createMockReservation({ id: 3 })];
    service.findByUser.mockResolvedValue(reservations);

    const result = await controller.findByUser(5);

    expect(service.findByUser).toHaveBeenCalledWith(5);
    expect(result).toEqual(reservations);
  });

  it('should return a reservation by id', async () => {
    const reservation = createMockReservation({ id: 4 });
    service.findOne.mockResolvedValue(reservation);

    const result = await controller.findOne(reservation.id);

    expect(service.findOne).toHaveBeenCalledWith(reservation.id);
    expect(result).toEqual(reservation);
  });

  it('should update a reservation', async () => {
    const reservation = createMockReservation({ id: 6, status: 'cancelled' });
    const dto: UpdateReservationDto = { status: 'reserved' };
    service.update.mockResolvedValue(reservation);

    const result = await controller.update(reservation.id, dto);

    expect(service.update).toHaveBeenCalledWith(reservation.id, dto);
    expect(result).toEqual(reservation);
  });

  it('should remove a reservation', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(7);

    expect(service.remove).toHaveBeenCalledWith(7);
  });
});
