import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  const buildPayload = (overrides: Partial<CreateUserDto> = {}): CreateUserDto => ({
    name: 'Alice',
    email: 'alice@example.com',
    password: 'secret1',
    role: 'user',
    ...overrides,
  });

  const validateDto = async (payload: Partial<CreateUserDto>) => {
    const instance = plainToInstance(CreateUserDto, payload);
    return validate(instance);
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(buildPayload());
    expect(errors).toHaveLength(0);
  });

  it('rejects missing name', async () => {
    const { name, ...partial } = buildPayload();
    const errors = await validateDto(partial);
    expect(errors).not.toHaveLength(0);
  });

  it('rejects invalid email', async () => {
    const errors = await validateDto(buildPayload({ email: 'invalid-email' }));
    expect(errors).not.toHaveLength(0);
  });

  it('rejects short password', async () => {
    const errors = await validateDto(buildPayload({ password: '123' }));
    expect(errors).not.toHaveLength(0);
  });

  it('rejects invalid role', async () => {
    const errors = await validateDto(buildPayload({ role: 'manager' as unknown as 'user' }));
    expect(errors).not.toHaveLength(0);
  });
});

