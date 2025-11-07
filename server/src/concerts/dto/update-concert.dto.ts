import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, IsPositive } from 'class-validator';
import { CreateConcertDto } from './create-concert.dto';

export class UpdateConcertDto extends PartialType(CreateConcertDto) {
  @IsOptional()
  @IsInt()
  @IsPositive()
  totalSeats?: number;
}
