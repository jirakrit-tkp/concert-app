import { IsIn } from 'class-validator';

export class UpdateReservationDto {
  @IsIn(['reserved', 'cancelled'])
  status: 'reserved' | 'cancelled';
}
