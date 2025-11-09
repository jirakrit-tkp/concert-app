import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateReservationDto } from './update-reservation.dto';

describe('UpdateReservationDto', () => {
  const validateDto = async (payload: Partial<UpdateReservationDto>) => {
    const instance = plainToInstance(UpdateReservationDto, payload);
    return validate(instance);
  };

  it('accepts reserved status', async () => {
    const errors = await validateDto({ status: 'reserved' });
    expect(errors).toHaveLength(0);
  });

  it('accepts cancelled status', async () => {
    const errors = await validateDto({ status: 'cancelled' });
    expect(errors).toHaveLength(0);
  });

  it('rejects missing status', async () => {
    const errors = await validateDto({});
    expect(errors).not.toHaveLength(0);
  });

  it('rejects invalid status', async () => {
    const errors = await validateDto({ status: 'pending' as unknown as 'reserved' });
    expect(errors).not.toHaveLength(0);
  });
});

