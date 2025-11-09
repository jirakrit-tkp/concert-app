import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateConcertDto } from './create-concert.dto';

describe('CreateConcertDto', () => {
  const buildPayload = (overrides: Partial<CreateConcertDto> = {}): CreateConcertDto => ({
    name: 'Valid concert',
    description: 'Valid description',
    totalSeats: 150,
    ...overrides,
  });

  const validateDto = async (payload: Partial<CreateConcertDto>) => {
    const instance = plainToInstance(CreateConcertDto, payload);
    return validate(instance);
  };

  it('accepts a fully valid payload', async () => {
    const errors = await validateDto(buildPayload());
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty name', async () => {
    const errors = await validateDto(buildPayload({ name: '' }));
    expect(errors).not.toHaveLength(0);
  });

  it('rejects a missing name', async () => {
    const { name, ...partial } = buildPayload();
    const errors = await validateDto(partial);
    expect(errors).not.toHaveLength(0);
  });

  it('rejects a missing description', async () => {
    const { description, ...partial } = buildPayload();
    const errors = await validateDto(partial);
    expect(errors).not.toHaveLength(0);
  });

  it('rejects non-positive totalSeats values', async () => {
    const errors = await validateDto(buildPayload({ totalSeats: 0 }));
    expect(errors).not.toHaveLength(0);
  });

  it('rejects non-integer totalSeats values', async () => {
    const errors = await validateDto(buildPayload({ totalSeats: 12.5 as unknown as number }));
    expect(errors).not.toHaveLength(0);
  });
});

