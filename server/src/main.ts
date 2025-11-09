// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 3001);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ✅ เพิ่มบรรทัดนี้
  app.enableCors({
    origin: 'http://localhost:3000',  // พอร์ตฝั่ง Next.js
    methods: 'GET,POST,PUT,DELETE',
  });

  app.setGlobalPrefix('api');

  await app.listen(3001);
}
bootstrap();