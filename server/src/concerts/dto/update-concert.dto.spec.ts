import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateConcertDto } from './update-concert.dto';

describe('UpdateConcertDto', () => {
  const validateDto = async (payload: Partial<UpdateConcertDto>) => {
    const instance = plainToInstance(UpdateConcertDto, payload);
    return validate(instance);
  };

  it('accepts an empty payload', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid partial payload', async () => {
    const errors = await validateDto({
      name: 'Updated name',
      description: 'Updated description',
      totalSeats: 200,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty name when provided', async () => {
    const errors = await validateDto({ name: '' });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects non-positive totalSeats values when provided', async () => {
    const errors = await validateDto({ totalSeats: 0 });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects non-integer totalSeats values when provided', async () => {
    const errors = await validateDto({ totalSeats: 3.14 as unknown as number });
    expect(errors).not.toHaveLength(0);
  });
});

