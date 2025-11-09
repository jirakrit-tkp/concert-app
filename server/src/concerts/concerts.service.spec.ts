import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConcertsService } from './concerts.service';
import { Concert } from './entities/concert.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';

describe('ConcertsService', () => {
  let service: ConcertsService;
  let repository: jest.Mocked<Repository<Concert>>;

  const createMockConcert = (overrides: Partial<Concert> = {}): Concert => ({
    id: 1,
    name: 'Sample Concert',
    description: 'Sample description',
    total_seats: 100,
    available_seats: 80,
    reservations: [],
    ...overrides,
  });

  const buildCreateDto = (overrides: Partial<CreateConcertDto> = {}): CreateConcertDto => ({
    name: 'New Concert',
    description: 'New description',
    totalSeats: 150,
    ...overrides,
  });

  const buildUpdateDto = (overrides: Partial<UpdateConcertDto> = {}): UpdateConcertDto => ({
    name: 'Updated Concert',
    description: 'Updated description',
    totalSeats: 120,
    ...overrides,
  });

  beforeEach(async () => {
    const repositoryValue = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    } satisfies Partial<jest.Mocked<Repository<Concert>>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcertsService,
        {
          provide: getRepositoryToken(Concert),
          useValue: repositoryValue,
        },
      ],
    }).compile();

    service = module.get<ConcertsService>(ConcertsService);
    repository = module.get<Repository<Concert>>(getRepositoryToken(Concert)) as jest.Mocked<Repository<Concert>>;
  });

  it('should create a concert', async () => {
    const dto = buildCreateDto();
    const createdConcert = createMockConcert({
      name: dto.name,
      description: dto.description,
      total_seats: dto.totalSeats,
      available_seats: dto.totalSeats,
    });

    repository.create.mockReturnValue(createdConcert);
    repository.save.mockResolvedValue(createdConcert);

    const result = await service.create(dto);

    expect(repository.create).toHaveBeenCalledWith({
      name: dto.name,
      description: dto.description,
      total_seats: dto.totalSeats,
      available_seats: dto.totalSeats,
    });
    expect(repository.save).toHaveBeenCalledWith(createdConcert);
    expect(result).toEqual(createdConcert);
  });

  it('should return all concerts', async () => {
    const concerts = [createMockConcert({ id: 1 }), createMockConcert({ id: 2 })];
    repository.find.mockResolvedValue(concerts);

    const result = await service.findAll();

    expect(repository.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
    expect(result).toEqual(concerts);
  });

  it('should return a single concert', async () => {
    const concert = createMockConcert();
    repository.findOne.mockResolvedValue(concert);

    const result = await service.findOne(concert.id);

    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: concert.id } });
    expect(result).toEqual(concert);
  });

  it('should throw NotFoundException when concert does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should update a concert', async () => {
    const originalConcert = createMockConcert();
    const dto = buildUpdateDto();

    repository.findOne.mockResolvedValue(originalConcert);
    repository.save.mockImplementation(async (value) => value as Concert);

    const result = await service.update(originalConcert.id, dto);

    if (dto.totalSeats === undefined) {
      throw new Error('Expected totalSeats to be defined in update dto');
    }

    const reservedSeats = originalConcert.total_seats - originalConcert.available_seats;
    const expectedAvailableSeats = dto.totalSeats - reservedSeats;

    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: originalConcert.id } });
    expect(repository.save).toHaveBeenCalledWith({
      ...originalConcert,
      name: dto.name,
      description: dto.description,
      total_seats: dto.totalSeats,
      available_seats: expectedAvailableSeats,
    });
    expect(result.name).toEqual(dto.name);
    expect(result.description).toEqual(dto.description);
    expect(result.total_seats).toEqual(dto.totalSeats);
    expect(result.available_seats).toEqual(expectedAvailableSeats);
  });

  it('should throw BadRequestException when reducing total seats below reserved', async () => {
    const originalConcert = createMockConcert({
      total_seats: 100,
      available_seats: 10,
    });

    repository.findOne.mockResolvedValue(originalConcert);

    await expect(
      service.update(originalConcert.id, buildUpdateDto({ totalSeats: 50 })),
    ).rejects.toThrow(BadRequestException);
  });

  it('should remove a concert', async () => {
    const existingConcert = createMockConcert();
    repository.findOne.mockResolvedValue(existingConcert);
    repository.remove.mockResolvedValue(existingConcert);

    await service.remove(existingConcert.id);

    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: existingConcert.id } });
    expect(repository.remove).toHaveBeenCalledWith(existingConcert);
  });

  it('should forward persistence errors when creation fails', async () => {
    const dto = buildCreateDto();
    const persistenceError = new Error('insert failed');

    repository.create.mockReturnValue(createMockConcert());
    repository.save.mockRejectedValue(persistenceError);

    await expect(service.create(dto)).rejects.toBe(persistenceError);
  });

  it('should forward persistence errors when fetching all concerts fails', async () => {
    const persistenceError = new Error('query failed');
    repository.find.mockRejectedValue(persistenceError);

    await expect(service.findAll()).rejects.toBe(persistenceError);
  });

  it('should forward persistence errors when removal fails', async () => {
    const existingConcert = createMockConcert();
    const persistenceError = new Error('delete failed');

    repository.findOne.mockResolvedValue(existingConcert);
    repository.remove.mockRejectedValue(persistenceError);

    await expect(service.remove(existingConcert.id)).rejects.toBe(persistenceError);
  });
});
