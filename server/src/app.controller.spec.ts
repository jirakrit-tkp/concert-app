import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return root message', () => {
    expect(appController.getRoot()).toEqual({ message: 'Hello World from NestJS Root!' });
  });

  it('should return hello message', () => {
    expect(appController.getHello()).toEqual({ message: 'Hello from NestJS backend!' });
  });
});
