import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  const validateDto = async (payload: Partial<UpdateUserDto>) => {
    const instance = plainToInstance(UpdateUserDto, payload);
    return validate(instance);
  };

  it('accepts an empty payload', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts valid partial fields', async () => {
    const errors = await validateDto({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'password',
      role: 'admin',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid email when provided', async () => {
    const errors = await validateDto({ email: 'invalid' });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects short password when provided', async () => {
    const errors = await validateDto({ password: '123' });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects invalid role when provided', async () => {
    const errors = await validateDto({ role: 'guest' as unknown as 'user' });
    expect(errors).not.toHaveLength(0);
  });
});

