import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConcertsModule } from './concerts/concerts.module';
import { UsersModule } from './users/users.module';
import { ReservationsModule } from './reservations/reservations.module';

// import entities ของแต่ละ module
@Module({
  imports: [
    // 🧩 เชื่อมต่อกับ PostgreSQL ผ่าน TypeORM
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost', // ถ้าใช้ Docker บนเครื่องตัวเองใช้ localhost ได้เลย
      port: 5432,
      username: 'postgres', // ต้องตรงกับค่าใน docker run
      password: 'password', // ต้องตรงกับค่าใน docker run
      database: 'concert_app', // ต้องตรงกับ POSTGRES_DB
      synchronize: true, // ให้ TypeORM สร้าง table อัตโนมัติ (เปิดเฉพาะตอน dev)
      dropSchema: true,
      autoLoadEntities: true,
    }),

    // 🧱 รวม modules ของคุณ
    ConcertsModule,
    UsersModule,
    ReservationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
