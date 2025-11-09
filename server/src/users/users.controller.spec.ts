import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { User } from './entities/user.entity';
import { Reservation } from '../reservations/entities/reservation.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'User One',
    email: 'user@example.com',
    password: 'hashed',
    role: 'user',
    reservations: [],
    ...overrides,
  });

  const createSafeUser = (overrides: Partial<Omit<User, 'password'>> = {}) => ({
    id: 1,
    name: 'User One',
    email: 'user@example.com',
    role: 'user' as const,
    reservations: [],
    ...overrides,
  });

  const createMockReservation = (overrides: Partial<Reservation> = {}): Reservation => ({
    id: 5,
    user: createMockUser(),
    concert: {
      id: 2,
      name: 'Concert',
      description: 'Great show',
      total_seats: 100,
      available_seats: 90,
      reservations: [],
    },
    status: 'reserved',
    created_at: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const serviceValue = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getReservationHistory: jest.fn(),
      authenticate: jest.fn(),
    } satisfies Partial<jest.Mocked<UsersService>>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: serviceValue,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService) as jest.Mocked<UsersService>;
  });

  it('should create a user', async () => {
    const dto: CreateUserDto = {
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret1',
      role: 'admin',
    };
    const user = createSafeUser({ id: 9, name: dto.name, email: dto.email, role: dto.role });
    service.create.mockResolvedValue(user);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(user);
  });

  it('should return all users', async () => {
    const users = [createSafeUser({ id: 1 }), createSafeUser({ id: 2 })];
    service.findAll.mockResolvedValue(users);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual(users);
  });

  it('should authenticate a user', async () => {
    const dto: LoginUserDto = { email: 'alice@example.com', password: 'secret1' };
    const user = createSafeUser({ id: 11, email: dto.email });
    service.authenticate.mockResolvedValue(user);

    const result = await controller.login(dto);

    expect(service.authenticate).toHaveBeenCalledWith(dto.email, dto.password);
    expect(result).toEqual(user);
  });

  it('should return a user by id', async () => {
    const user = createSafeUser({ id: 7 });
    service.findOne.mockResolvedValue(user);

    const result = await controller.findOne(user.id);

    expect(service.findOne).toHaveBeenCalledWith(user.id);
    expect(result).toEqual(user);
  });

  it('should update a user', async () => {
    const dto: UpdateUserDto = { name: 'Updated' };
    const user = createSafeUser({ id: 13, name: dto.name });
    service.update.mockResolvedValue(user);

    const result = await controller.update(user.id, dto);

    expect(service.update).toHaveBeenCalledWith(user.id, dto);
    expect(result).toEqual(user);
  });

  it('should remove a user', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(15);

    expect(service.remove).toHaveBeenCalledWith(15);
  });

  it('should return reservation history', async () => {
    const reservations = [createMockReservation({ id: 21 })];
    service.getReservationHistory.mockResolvedValue(reservations);

    const result = await controller.reservationHistory(12);

    expect(service.getReservationHistory).toHaveBeenCalledWith(12);
    expect(result).toEqual(reservations);
  });
});
