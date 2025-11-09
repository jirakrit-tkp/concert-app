import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<Repository<User>>;
  let reservationsRepository: jest.Mocked<Repository<Reservation>>;

  const createUsersRepositoryMock = () =>
    ({
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    }) satisfies Partial<jest.Mocked<Repository<User>>>;

  const createReservationsRepositoryMock = () =>
    ({
      find: jest.fn(),
    }) satisfies Partial<jest.Mocked<Repository<Reservation>>>;

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'User One',
    email: 'user@example.com',
    password: 'hashed',
    role: 'user',
    reservations: [],
    ...overrides,
  });

  const createMockReservation = (overrides: Partial<Reservation> = {}): Reservation => ({
    id: 10,
    user: createMockUser(),
    concert: {
      id: 2,
      name: 'Concert',
      description: 'Description',
      total_seats: 100,
      available_seats: 90,
      reservations: [],
    },
    status: 'reserved',
    created_at: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const usersRepoValue = createUsersRepositoryMock();
    const reservationsRepoValue = createReservationsRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: usersRepoValue,
        },
        {
          provide: getRepositoryToken(Reservation),
          useValue: reservationsRepoValue,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User)) as jest.Mocked<Repository<User>>;
    reservationsRepository = module.get<Repository<Reservation>>(getRepositoryToken(Reservation)) as jest.Mocked<Repository<Reservation>>;
  });

  it('should create a user with default role and sanitize password', async () => {
    const dto = { name: 'Alice', email: 'alice@example.com', password: 'secret1' };
    const createdUser = createMockUser({ id: 3, name: dto.name, email: dto.email, password: dto.password });

    usersRepository.create.mockReturnValue(createdUser);
    usersRepository.save.mockResolvedValue(createdUser);

    const result = await service.create(dto);

    expect(usersRepository.create).toHaveBeenCalledWith({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: 'user',
    });
    expect(usersRepository.save).toHaveBeenCalledWith(createdUser);
    expect(result).toEqual({
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      reservations: createdUser.reservations,
    });
    expect((result as unknown as { password?: string }).password).toBeUndefined();
  });

  it('should propagate persistence errors during user creation', async () => {
    const dto = { name: 'Alice', email: 'alice@example.com', password: 'secret1', role: 'admin' as const };
    const createdUser = createMockUser({ ...dto, role: 'admin' });
    const persistenceError = new Error('insert failed');

    usersRepository.create.mockReturnValue(createdUser);
    usersRepository.save.mockRejectedValue(persistenceError);

    await expect(service.create(dto)).rejects.toBe(persistenceError);
  });

  it('should list users without passwords', async () => {
    const users = [createMockUser({ id: 1 }), createMockUser({ id: 2 })];
    usersRepository.find.mockResolvedValue(users);

    const result = await service.findAll();

    expect(usersRepository.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
    expect(result).toEqual(
      users.map(({ password, ...rest }) => ({
        ...rest,
        reservations: rest.reservations,
      })),
    );
  });

  it('should return a single user by id', async () => {
    const user = createMockUser({ id: 7 });
    usersRepository.findOne.mockResolvedValue(user);

    const result = await service.findOne(user.id);

    expect(usersRepository.findOne).toHaveBeenCalledWith({ where: { id: user.id } });
    expect(result).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      reservations: user.reservations,
    });
  });

  it('should throw when user is not found', async () => {
    usersRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
  });

  it('should update a user and sanitize password', async () => {
    const existingUser = createMockUser({ id: 4 });
    usersRepository.findOne.mockResolvedValue(existingUser);
    usersRepository.save.mockImplementation(async (user) => user as User);

    const result = await service.update(existingUser.id, {
      name: 'Updated',
      email: 'updated@example.com',
      password: 'newpass',
      role: 'admin',
    });

    expect(usersRepository.save).toHaveBeenCalledWith({
      ...existingUser,
      name: 'Updated',
      email: 'updated@example.com',
      password: 'newpass',
      role: 'admin',
    });
    expect(result).toEqual({
      id: existingUser.id,
      name: 'Updated',
      email: 'updated@example.com',
      role: 'admin',
      reservations: existingUser.reservations,
    });
  });

  it('should throw when updating non-existing user', async () => {
    usersRepository.findOne.mockResolvedValue(null);

    await expect(service.update(5, { name: 'Test' })).rejects.toThrow(NotFoundException);
  });

  it('should remove a user', async () => {
    const user = createMockUser({ id: 8 });
    usersRepository.findOne.mockResolvedValue(user);
    usersRepository.remove.mockResolvedValue(user);

    await service.remove(user.id);

    expect(usersRepository.remove).toHaveBeenCalledWith(user);
  });

  it('should throw when removing non-existing user', async () => {
    usersRepository.findOne.mockResolvedValue(null);

    await expect(service.remove(8)).rejects.toThrow(NotFoundException);
  });

  it('should return reservation history for a user', async () => {
    const user = createMockUser({ id: 9 });
    const reservations = [createMockReservation({ id: 100 })];
    usersRepository.findOne.mockResolvedValue(user);
    reservationsRepository.find.mockResolvedValue(reservations);

    const result = await service.getReservationHistory(user.id);

    expect(reservationsRepository.find).toHaveBeenCalledWith({
      where: { user: { id: user.id } },
      relations: ['concert', 'user'],
      order: { created_at: 'DESC' },
    });
    expect(result).toEqual(reservations);
  });

  it('should propagate errors when reservation history retrieval fails', async () => {
    const user = createMockUser({ id: 11 });
    const persistenceError = new Error('query failed');
    usersRepository.findOne.mockResolvedValue(user);
    reservationsRepository.find.mockRejectedValue(persistenceError);

    await expect(service.getReservationHistory(user.id)).rejects.toBe(persistenceError);
  });

  it('should authenticate user with correct credentials', async () => {
    const user = createMockUser({ email: 'alice@example.com', password: 'secret' });
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    };
    usersRepository.createQueryBuilder.mockReturnValue(queryBuilder as never);

    const result = await service.authenticate('alice@example.com', 'secret');

    expect(usersRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.password');
    expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', { email: 'alice@example.com' });
    expect(result).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      reservations: user.reservations,
    });
  });

  it('should throw when authentication fails', async () => {
    const user = createMockUser({ email: 'alice@example.com', password: 'secret' });
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    };
    usersRepository.createQueryBuilder.mockReturnValue(queryBuilder as never);

    await expect(service.authenticate('alice@example.com', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw unauthorized when user not found during authentication', async () => {
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    usersRepository.createQueryBuilder.mockReturnValue(queryBuilder as never);

    await expect(service.authenticate('missing@example.com', 'secret')).rejects.toThrow(UnauthorizedException);
  });
});
