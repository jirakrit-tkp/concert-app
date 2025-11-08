import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { Reservation } from '../reservations/entities/reservation.entity';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
  ) {}

  private sanitizeUser(user: User): SafeUser {
    // password column is excluded by default, but ensure runtime safety
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  create(createUserDto: CreateUserDto): Promise<SafeUser> {
    const user = this.usersRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password: createUserDto.password,
      role: createUserDto.role ?? 'user',
    });

    return this.usersRepository.save(user).then((savedUser) => this.sanitizeUser(savedUser));
  }

  findAll(): Promise<SafeUser[]> {
    return this.usersRepository.find({ order: { id: 'ASC' } }).then((users) => users.map((user) => this.sanitizeUser(user)));
  }

  async findOne(id: number): Promise<SafeUser> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return this.sanitizeUser(user);
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    if (updateUserDto.name !== undefined) {
      user.name = updateUserDto.name;
    }
    if (updateUserDto.email !== undefined) {
      user.email = updateUserDto.email;
    }
    if (updateUserDto.password !== undefined) {
      user.password = updateUserDto.password;
    }
    if (updateUserDto.role !== undefined) {
      user.role = updateUserDto.role;
    }
    const updatedUser = await this.usersRepository.save(user);
    return this.sanitizeUser(updatedUser);
  }

  async remove(id: number): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    await this.usersRepository.remove(user);
  }

  async getReservationHistory(id: number): Promise<Reservation[]> {
    await this.findOne(id);
    return this.reservationsRepository.find({
      where: { user: { id } },
      relations: ['concert', 'user'],
      order: { created_at: 'DESC' },
    });
  }

  async authenticate(email: string, password: string): Promise<SafeUser> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.sanitizeUser(user);
  }
}
