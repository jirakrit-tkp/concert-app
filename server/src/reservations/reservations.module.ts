import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { Reservation } from './entities/reservation.entity';
import { User } from '../users/entities/user.entity';
import { Concert } from '../concerts/entities/concert.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, User, Concert])],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [TypeOrmModule],
})
export class ReservationsModule {}
