import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { ReservationsService } from './reservations.service';
import { Reservation } from './entities/reservation.entity';
import { User } from '../users/entities/user.entity';
import { Concert } from '../concerts/entities/concert.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationsRepository: jest.Mocked<Repository<Reservation>>;
  let usersRepository: jest.Mocked<Repository<User>>;
  let concertsRepository: jest.Mocked<Repository<Concert>>;
  let transactionMock: jest.Mock;

  const createRepositoryMock = <T extends ObjectLiteral>() =>
    ({
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    }) satisfies Partial<jest.Mocked<Repository<T>>>;

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'User One',
    email: 'user@example.com',
    password: 'hash',
    role: 'user',
    reservations: [],
    ...overrides,
  });

  const createMockConcert = (overrides: Partial<Concert> = {}): Concert => ({
    id: 2,
    name: 'Concert',
    description: 'Description',
    total_seats: 100,
    available_seats: 50,
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

  const setupTransaction = (
    managerRepos: {
      reservations?: Partial<jest.Mocked<Repository<Reservation>>>;
      users?: Partial<jest.Mocked<Repository<User>>>;
      concerts?: Partial<jest.Mocked<Repository<Concert>>>;
    },
  ) => {
    const manager = {
      getRepository: jest.fn((target: unknown) => {
        if (target === Reservation) {
          return managerRepos.reservations ?? reservationsRepository;
        }
        if (target === User) {
          return managerRepos.users ?? usersRepository;
        }
        if (target === Concert) {
          return managerRepos.concerts ?? concertsRepository;
        }
        throw new Error('Unexpected repository requested');
      }),
    };
    transactionMock.mockImplementation(async (fn) => fn(manager as never));
  };

  beforeEach(async () => {
    const reservationsRepoValue = createRepositoryMock<Reservation>();
    const usersRepoValue = createRepositoryMock<User>();
    const concertsRepoValue = createRepositoryMock<Concert>();

    transactionMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: reservationsRepoValue,
        },
        {
          provide: getRepositoryToken(User),
          useValue: usersRepoValue,
        },
        {
          provide: getRepositoryToken(Concert),
          useValue: concertsRepoValue,
        },
        {
          provide: DataSource,
          useValue: { transaction: transactionMock },
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    reservationsRepository = module.get<Repository<Reservation>>(getRepositoryToken(Reservation)) as jest.Mocked<Repository<Reservation>>;
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User)) as jest.Mocked<Repository<User>>;
    concertsRepository = module.get<Repository<Concert>>(getRepositoryToken(Concert)) as jest.Mocked<Repository<Concert>>;

    transactionMock.mockReset();
  });

  it('should create a reservation', async () => {
    const user = createMockUser();
    const concert = createMockConcert({ available_seats: 5 });
    const reservation = createMockReservation({ user, concert });

    const managerUsersRepo = createRepositoryMock<User>();
    managerUsersRepo.findOne!.mockResolvedValue(user);
    const managerConcertsRepo = createRepositoryMock<Concert>();
    managerConcertsRepo.findOne!.mockResolvedValue(concert);
    managerConcertsRepo.save!.mockResolvedValue(concert);
    const managerReservationsRepo = createRepositoryMock<Reservation>();
    managerReservationsRepo.findOne!.mockResolvedValue(null);
    managerReservationsRepo.create!.mockReturnValue(reservation);
    managerReservationsRepo.save!.mockResolvedValue(reservation);

    setupTransaction({
      users: managerUsersRepo,
      concerts: managerConcertsRepo,
      reservations: managerReservationsRepo,
    });

    const result = await service.create({ userId: user.id, concertId: concert.id });

    expect(managerUsersRepo.findOne).toHaveBeenCalledWith({ where: { id: user.id } });
    expect(managerConcertsRepo.findOne).toHaveBeenCalledWith({ where: { id: concert.id } });
    expect(managerReservationsRepo.findOne).toHaveBeenCalledWith({
      where: { user: { id: user.id }, concert: { id: concert.id } },
    });
    expect(managerReservationsRepo.create).toHaveBeenCalledWith({
      user,
      concert,
      status: 'reserved',
    });
    expect(managerConcertsRepo.save).toHaveBeenCalledWith({ ...concert, available_seats: 4 });
    expect(managerReservationsRepo.save).toHaveBeenCalledWith(reservation);
    expect(result).toEqual(reservation);
  });

  it('should throw when user does not exist during create', async () => {
    const managerUsersRepo = createRepositoryMock<User>();
    managerUsersRepo.findOne!.mockResolvedValue(null);

    setupTransaction({
      users: managerUsersRepo,
    });

    await expect(service.create({ userId: 1, concertId: 2 })).rejects.toThrow(NotFoundException);
  });

  it('should throw when concert does not exist during create', async () => {
    const user = createMockUser();
    const managerUsersRepo = createRepositoryMock<User>();
    managerUsersRepo.findOne!.mockResolvedValue(user);
    const managerConcertsRepo = createRepositoryMock<Concert>();
    managerConcertsRepo.findOne!.mockResolvedValue(null);

    setupTransaction({
      users: managerUsersRepo,
      concerts: managerConcertsRepo,
    });

    await expect(service.create({ userId: user.id, concertId: 123 })).rejects.toThrow(NotFoundException);
  });

  it('should prevent duplicate reservation for same user and concert', async () => {
    const user = createMockUser();
    const concert = createMockConcert();
    const managerUsersRepo = createRepositoryMock<User>();
    managerUsersRepo.findOne!.mockResolvedValue(user);
    const managerConcertsRepo = createRepositoryMock<Concert>();
    managerConcertsRepo.findOne!.mockResolvedValue(concert);
    const managerReservationsRepo = createRepositoryMock<Reservation>();
    managerReservationsRepo.findOne!.mockResolvedValue(createMockReservation({ user, concert }));

    setupTransaction({
      users: managerUsersRepo,
      concerts: managerConcertsRepo,
      reservations: managerReservationsRepo,
    });

    await expect(service.create({ userId: user.id, concertId: concert.id })).rejects.toThrow(BadRequestException);
  });

  it('should prevent reservation when no seats are available', async () => {
    const user = createMockUser();
    const concert = createMockConcert({ available_seats: 0 });
    const managerUsersRepo = createRepositoryMock<User>();
    managerUsersRepo.findOne!.mockResolvedValue(user);
    const managerConcertsRepo = createRepositoryMock<Concert>();
    managerConcertsRepo.findOne!.mockResolvedValue(concert);
    const managerReservationsRepo = createRepositoryMock<Reservation>();
    managerReservationsRepo.findOne!.mockResolvedValue(null);

    setupTransaction({
      users: managerUsersRepo,
      concerts: managerConcertsRepo,
      reservations: managerReservationsRepo,
    });

    await expect(service.create({ userId: user.id, concertId: concert.id })).rejects.toThrow(BadRequestException);
  });

  it('should propagate persistence errors thrown inside transaction', async () => {
    const user = createMockUser();
    const concert = createMockConcert();
    const persistenceError = new Error('transaction failed');

    const managerUsersRepo = createRepositoryMock<User>();
    managerUsersRepo.findOne!.mockResolvedValue(user);
    const managerConcertsRepo = createRepositoryMock<Concert>();
    managerConcertsRepo.findOne!.mockResolvedValue(concert);
    managerConcertsRepo.save!.mockResolvedValue(concert);
    const managerReservationsRepo = createRepositoryMock<Reservation>();
    managerReservationsRepo.findOne!.mockResolvedValue(null);
    managerReservationsRepo.create!.mockReturnValue(createMockReservation({ user, concert }));
    managerReservationsRepo.save!.mockRejectedValue(persistenceError);

    setupTransaction({
      users: managerUsersRepo,
      concerts: managerConcertsRepo,
      reservations: managerReservationsRepo,
    });

    await expect(service.create({ userId: user.id, concertId: concert.id })).rejects.toBe(persistenceError);
  });

  it('should list all reservations', async () => {
    const reservations = [createMockReservation({ id: 1 }), createMockReservation({ id: 2 })];
    reservationsRepository.find.mockResolvedValue(reservations);

    const result = await service.findAll();

    expect(reservationsRepository.find).toHaveBeenCalledWith({
      relations: ['concert', 'user'],
      order: { created_at: 'DESC' },
    });
    expect(result).toEqual(reservations);
  });

  it('should return a reservation by id', async () => {
    const reservation = createMockReservation({ id: 5 });
    reservationsRepository.findOne.mockResolvedValue(reservation);

    const result = await service.findOne(reservation.id);

    expect(reservationsRepository.findOne).toHaveBeenCalledWith({
      where: { id: reservation.id },
      relations: ['concert', 'user'],
    });
    expect(result).toEqual(reservation);
  });

  it('should throw when reservation not found', async () => {
    reservationsRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
  });

  it('should update reservation when status unchanged', async () => {
    const reservation = createMockReservation({ status: 'reserved' });
    reservationsRepository.findOne.mockResolvedValue(reservation);

    const result = await service.update(reservation.id, { status: 'reserved' });

    expect(reservationsRepository.findOne).toHaveBeenCalled();
    expect(result).toEqual(reservation);
    expect(concertsRepository.save).not.toHaveBeenCalled();
    expect(reservationsRepository.save).not.toHaveBeenCalled();
  });

  it('should cancel a reservation and increment seats', async () => {
    const reservation = createMockReservation({
      status: 'reserved',
      concert: createMockConcert({ available_seats: 3 }),
    });
    reservationsRepository.findOne.mockResolvedValue(reservation);
    concertsRepository.save.mockResolvedValue(reservation.concert);
    reservationsRepository.save.mockResolvedValue({ ...reservation, status: 'cancelled' });

    const result = await service.update(reservation.id, { status: 'cancelled' });

    expect(concertsRepository.save).toHaveBeenCalledWith({ ...reservation.concert, available_seats: 4 });
    expect(reservationsRepository.save).toHaveBeenCalledWith({ ...reservation, status: 'cancelled' });
    expect(result.status).toEqual('cancelled');
  });

  it('should reinstate a cancelled reservation when seats available', async () => {
    const reservation = createMockReservation({
      status: 'cancelled',
      concert: createMockConcert({ available_seats: 2 }),
    });
    reservationsRepository.findOne.mockResolvedValue(reservation);
    concertsRepository.save.mockResolvedValue(reservation.concert);
    reservationsRepository.save.mockResolvedValue({ ...reservation, status: 'reserved' });

    const result = await service.update(reservation.id, { status: 'reserved' });

    expect(concertsRepository.save).toHaveBeenCalledWith({ ...reservation.concert, available_seats: 1 });
    expect(reservationsRepository.save).toHaveBeenCalledWith({ ...reservation, status: 'reserved' });
    expect(result.status).toEqual('reserved');
  });

  it('should reject reinstating reservation if no seats available', async () => {
    const reservation = createMockReservation({
      status: 'cancelled',
      concert: createMockConcert({ available_seats: 0 }),
    });
    reservationsRepository.findOne.mockResolvedValue(reservation);

    await expect(service.update(reservation.id, { status: 'reserved' })).rejects.toThrow(BadRequestException);
  });

  it('should reject unsupported status transitions', async () => {
    const reservation = createMockReservation({ status: 'reserved' });
    reservationsRepository.findOne.mockResolvedValue(reservation);

    await expect(service.update(reservation.id, { status: 'pending' as unknown as 'reserved' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should remove reservation and free seat when reserved', async () => {
    const reservation = createMockReservation({
      status: 'reserved',
      concert: createMockConcert({ available_seats: 5 }),
    });
    reservationsRepository.findOne.mockResolvedValue(reservation);
    concertsRepository.save.mockResolvedValue(reservation.concert);
    reservationsRepository.remove.mockResolvedValue(reservation);

    await service.remove(reservation.id);

    expect(concertsRepository.save).toHaveBeenCalledWith({ ...reservation.concert, available_seats: 6 });
    expect(reservationsRepository.remove).toHaveBeenCalledWith(reservation);
  });

  it('should remove reservation without freeing seat when cancelled', async () => {
    const reservation = createMockReservation({
      status: 'cancelled',
      concert: createMockConcert({ available_seats: 5 }),
    });
    reservationsRepository.findOne.mockResolvedValue(reservation);
    reservationsRepository.remove.mockResolvedValue(reservation);

    await service.remove(reservation.id);

    expect(concertsRepository.save).not.toHaveBeenCalled();
    expect(reservationsRepository.remove).toHaveBeenCalledWith(reservation);
  });

  it('should propagate persistence errors during removal', async () => {
    const reservation = createMockReservation({
      status: 'reserved',
      concert: createMockConcert({ available_seats: 5 }),
    });
    const persistenceError = new Error('remove failed');
    reservationsRepository.findOne.mockResolvedValue(reservation);
    concertsRepository.save.mockResolvedValue(reservation.concert);
    reservationsRepository.remove.mockRejectedValue(persistenceError);

    await expect(service.remove(reservation.id)).rejects.toBe(persistenceError);
  });

  it('should list reservations by user', async () => {
    const reservations = [createMockReservation({ id: 1 })];
    reservationsRepository.find.mockResolvedValue(reservations);

    const result = await service.findByUser(3);

    expect(reservationsRepository.find).toHaveBeenCalledWith({
      where: { user: { id: 3 } },
      relations: ['concert', 'user'],
      order: { created_at: 'DESC' },
    });
    expect(result).toEqual(reservations);
  });

  it('should propagate errors when listing reservations by user fails', async () => {
    const persistenceError = new Error('query failed');
    reservationsRepository.find.mockRejectedValue(persistenceError);

    await expect(service.findByUser(1)).rejects.toBe(persistenceError);
  });
});
