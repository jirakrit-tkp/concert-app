import { IsInt, IsPositive } from 'class-validator';

export class CreateReservationDto {
  @IsInt()
  @IsPositive()
  userId: number;

  @IsInt()
  @IsPositive()
  concertId: number;
}
