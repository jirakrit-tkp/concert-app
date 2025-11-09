import { Test, TestingModule } from '@nestjs/testing';
import { ConcertsController } from './concerts.controller';
import { ConcertsService } from './concerts.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { Concert } from './entities/concert.entity';

describe('ConcertsController', () => {
  let controller: ConcertsController;
  let service: jest.Mocked<ConcertsService>;

  const createMockConcert = (overrides: Partial<Concert> = {}): Concert => ({
    id: 1,
    name: 'Sample Concert',
    description: 'Sample description',
    total_seats: 100,
    available_seats: 80,
    reservations: [],
    ...overrides,
  });

  beforeEach(async () => {
    const serviceValue = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } satisfies Partial<jest.Mocked<ConcertsService>>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConcertsController],
      providers: [
        {
          provide: ConcertsService,
          useValue: serviceValue,
        },
      ],
    }).compile();

    controller = module.get<ConcertsController>(ConcertsController);
    service = module.get<ConcertsService>(ConcertsService) as jest.Mocked<ConcertsService>;
  });

  it('should create a concert', async () => {
    const dto: CreateConcertDto = {
      name: 'New Concert',
      description: 'New description',
      totalSeats: 150,
    };
    const createdConcert = createMockConcert({ id: 2, name: dto.name });
    service.create.mockResolvedValue(createdConcert);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdConcert);
  });

  it('should return all concerts', async () => {
    const concerts = [createMockConcert({ id: 1 }), createMockConcert({ id: 2 })];
    service.findAll.mockResolvedValue(concerts);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual(concerts);
  });

  it('should return a single concert', async () => {
    const concert = createMockConcert({ id: 5 });
    service.findOne.mockResolvedValue(concert);

    const result = await controller.findOne(concert.id);

    expect(service.findOne).toHaveBeenCalledWith(concert.id);
    expect(result).toEqual(concert);
  });

  it('should update a concert', async () => {
    const concert = createMockConcert({ id: 7 });
    const dto: UpdateConcertDto = {
      name: 'Updated Concert',
      description: 'Updated description',
      totalSeats: 120,
    };
    service.update.mockResolvedValue(concert);

    const result = await controller.update(concert.id, dto);

    expect(service.update).toHaveBeenCalledWith(concert.id, dto);
    expect(result).toEqual(concert);
  });

  it('should remove a concert', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(9);

    expect(service.remove).toHaveBeenCalledWith(9);
  });
});
