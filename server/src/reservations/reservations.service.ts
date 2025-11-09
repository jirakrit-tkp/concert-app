import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { Reservation } from './entities/reservation.entity';
import { User } from '../users/entities/user.entity';
import { Concert } from '../concerts/entities/concert.entity';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Concert)
    private readonly concertsRepository: Repository<Concert>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createReservationDto: CreateReservationDto): Promise<Reservation> {
    return this.dataSource.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const concertsRepo = manager.getRepository(Concert);
      const reservationsRepo = manager.getRepository(Reservation);

      const user = await usersRepo.findOne({ where: { id: createReservationDto.userId } });
      if (!user) {
        throw new NotFoundException(`User with id ${createReservationDto.userId} not found`);
      }

      const concert = await concertsRepo.findOne({ where: { id: createReservationDto.concertId } });
      if (!concert) {
        throw new NotFoundException(`Concert with id ${createReservationDto.concertId} not found`);
      }

      const existingReservation = await reservationsRepo.findOne({
        where: { user: { id: user.id }, concert: { id: concert.id } },
      });

      if (existingReservation) {
        throw new BadRequestException('User already has a reservation for this concert');
      }

      if (concert.available_seats < 1) {
        throw new BadRequestException('No seats available for this concert');
      }

      const reservation = reservationsRepo.create({
        user,
        concert,
        status: 'reserved',
      });

      concert.available_seats -= 1;

      await concertsRepo.save(concert);
      return reservationsRepo.save(reservation);
    });
  }

  findAll(): Promise<Reservation[]> {
    return this.reservationsRepository.find({
      relations: ['concert', 'user'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
      relations: ['concert', 'user'],
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation with id ${id} not found`);
    }
    return reservation;
  }

  async update(id: number, updateReservationDto: UpdateReservationDto): Promise<Reservation> {
    const reservation = await this.findOne(id);

    if (reservation.status === updateReservationDto.status) {
      return reservation;
    }

    if (updateReservationDto.status === 'cancelled' && reservation.status === 'reserved') {
      reservation.status = 'cancelled';
      reservation.concert.available_seats += 1;
      await this.concertsRepository.save(reservation.concert);
      return this.reservationsRepository.save(reservation);
    }

    if (updateReservationDto.status === 'reserved' && reservation.status === 'cancelled') {
      if (reservation.concert.available_seats < 1) {
        throw new BadRequestException('No seats available to reinstate the reservation');
      }
      reservation.concert.available_seats -= 1;
      reservation.status = 'reserved';
      await this.concertsRepository.save(reservation.concert);
      return this.reservationsRepository.save(reservation);
    }

    throw new BadRequestException('Unsupported reservation status transition');
  }

  async remove(id: number): Promise<void> {
    const reservation = await this.findOne(id);

    if (reservation.status === 'reserved') {
      reservation.concert.available_seats += 1;
      await this.concertsRepository.save(reservation.concert);
    }

    await this.reservationsRepository.remove(reservation);
  }

  async findByUser(userId: number): Promise<Reservation[]> {
    return this.reservationsRepository.find({
      where: { user: { id: userId } },
      relations: ['concert', 'user'],
      order: { created_at: 'DESC' },
    });
  }
}
