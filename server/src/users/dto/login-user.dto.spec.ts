import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginUserDto } from './login-user.dto';

describe('LoginUserDto', () => {
  const validateDto = async (payload: Partial<LoginUserDto>) => {
    const instance = plainToInstance(LoginUserDto, payload);
    return validate(instance);
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto({
      email: 'alice@example.com',
      password: 'secret1',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects missing email', async () => {
    const errors = await validateDto({ password: 'secret1' });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects invalid email', async () => {
    const errors = await validateDto({ email: 'invalid', password: 'secret1' });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects missing password', async () => {
    const errors = await validateDto({ email: 'alice@example.com' });
    expect(errors).not.toHaveLength(0);
  });
});

