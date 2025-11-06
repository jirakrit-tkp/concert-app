import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Concert } from '../../concerts/entities/concert.entity';

@Entity()
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.reservations, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Concert, (concert) => concert.reservations, { onDelete: 'CASCADE' })
  concert: Concert;

  @Column({ default: 'reserved' })
  status: string; // reserved | cancelled

  @CreateDateColumn()
  created_at: Date;
}
