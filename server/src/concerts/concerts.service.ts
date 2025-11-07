import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { Concert } from './entities/concert.entity';

@Injectable()
export class ConcertsService {
  constructor(
    @InjectRepository(Concert)
    private readonly concertsRepository: Repository<Concert>,
  ) {}

  async create(createConcertDto: CreateConcertDto): Promise<Concert> {
    const concert = this.concertsRepository.create({
      name: createConcertDto.name,
      description: createConcertDto.description,
      total_seats: createConcertDto.totalSeats,
      available_seats: createConcertDto.totalSeats,
    });

    return this.concertsRepository.save(concert);
  }

  findAll(): Promise<Concert[]> {
    return this.concertsRepository.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Concert> {
    const concert = await this.concertsRepository.findOne({ where: { id } });
    if (!concert) {
      throw new NotFoundException(`Concert with id ${id} not found`);
    }
    return concert;
  }

  async update(id: number, updateConcertDto: UpdateConcertDto): Promise<Concert> {
    const concert = await this.findOne(id);

    if (updateConcertDto.name !== undefined) {
      concert.name = updateConcertDto.name;
    }

    if (updateConcertDto.description !== undefined) {
      concert.description = updateConcertDto.description;
    }

    if (updateConcertDto.totalSeats !== undefined) {
      const reservedSeats = concert.total_seats - concert.available_seats;
      if (updateConcertDto.totalSeats < reservedSeats) {
        throw new BadRequestException(
          `Cannot set total seats below currently reserved seats (${reservedSeats})`,
        );
      }

      concert.total_seats = updateConcertDto.totalSeats;
      concert.available_seats = updateConcertDto.totalSeats - reservedSeats;
    }

    return this.concertsRepository.save(concert);
  }

  async remove(id: number): Promise<void> {
    const concert = await this.findOne(id);
    await this.concertsRepository.remove(concert);
  }
}
